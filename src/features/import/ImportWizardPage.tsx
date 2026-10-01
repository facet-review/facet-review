import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { db } from '../../db/db';
import { importFile, saveImportNote } from '../../db/importRepository';
import { CSV_FIELDS, type CsvField, type CsvMapping } from '../../domain/import/csvFields';
import { createImport } from '../../domain/import/createImport';
import { importNoteRequired } from '../../domain/import/reconcile';
import { sourceLabel } from '../../domain/search/summary';
import type { ImportWarning, SourceRun } from '../../domain/types';
import { formatDate, formatNumber } from '../../app/format';
import { importPaths } from '../../app/modules';
import NotFoundPage from '../../app/NotFoundPage';
import { PageHeading } from '../../app/PageHeading';
import { newId, nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import { SelectField, TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import notice from '../../design/notice.module.css';
import { useProject } from '../project/useProject';
import { recomputeDuplicates } from './dedupService';
import { parseInWorker } from './worker/client';
import type { ParseResponse } from './worker/protocol';
import styles from './Import.module.css';

const SHOWN_WARNINGS = 20;
const PREVIEW_RECORDS = 5;
const MAPPED_FIELDS: readonly CsvField[] = CSV_FIELDS;

/** Import of one export file into a search run. */
export default function ImportWizardPage() {
  const project = useProject();
  const { runId = '' } = useParams();
  const data = useLiveQuery(async () => {
    const run = await db.sourceRuns.get(runId);
    const source = run ? await db.sources.get(run.sourceId) : undefined;
    const batches = await db.importBatches.where('sourceRunId').equals(runId).toArray();
    return { run: run ?? null, source: source ?? null, batches };
  }, [runId]);
  if (data === undefined) return null;
  if (!data.run || !data.source || data.run.projectId !== project.id) return <NotFoundPage />;
  return (
    <Wizard
      key={runId}
      projectId={project.id}
      run={data.run}
      sourceName={sourceLabel(data.source)}
      alreadyImported={data.batches.reduce((sum, batch) => sum + batch.recordCount, 0)}
    />
  );
}

interface WizardProps {
  projectId: string;
  run: SourceRun;
  sourceName: string;
  alreadyImported: number;
}

function Wizard({ projectId, run, sourceName, alreadyImported }: WizardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fileId = useId();
  const [file, setFile] = useState<{ name: string; text: string }>();
  const [parsed, setParsed] = useState<ParseResponse>();
  const [busy, setBusy] = useState<'reading' | 'importing'>();
  const [note, setNote] = useState(run.importNote ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [moreFiles, setMoreFiles] = useState(false);
  const runName = `${sourceName} – ${formatDate(run.date, i18n.language)}`;

  async function choose(chosen: File) {
    setBusy('reading');
    setParsed(undefined);
    const text = await chosen.text();
    setFile({ name: chosen.name, text });
    setParsed(await parseInWorker(text, chosen.name));
    setBusy(undefined);
  }

  async function remap(mapping: CsvMapping) {
    if (!file) return;
    setParsed(await parseInWorker(file.text, file.name, { format: 'csv', mapping }));
  }

  const result = parsed?.result;
  const count = result?.records.length ?? 0;
  const total = alreadyImported + count;
  const mismatch = run.reportedHits !== undefined && total !== run.reportedHits;
  const fewer = run.reportedHits !== undefined && total < run.reportedHits;
  const noteMissing = importNoteRequired(run.reportedHits, total, moreFiles) && note.trim() === '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!file || !parsed?.format || !result || count === 0 || noteMissing) return;
    setBusy('importing');
    const created = createImport(
      result,
      { projectId, sourceRunId: run.id, fileName: file.name, format: parsed.format },
      { newId, now: nowIso },
    );
    await importFile(db, created, nowIso());
    if (note.trim() !== (run.importNote ?? '')) await saveImportNote(db, run.id, note, nowIso());
    await recomputeDuplicates(projectId);
    void navigate(importPaths.page(projectId), {
      state: { message: t('importWizard.done', { count, file: file.name }) },
    });
  }

  const warningText = (warning: ImportWarning) => {
    const message = t(`importWarnings.${warning.code}` as 'importWarnings.missingEnd', {
      detail: warning.detail ?? '',
    });
    return warning.line ? t('importWarnings.atLine', { line: warning.line, message }) : message;
  };
  const number = (value: number) => formatNumber(value, i18n.language);

  return (
    <>
      <PageHeading
        title={t('importWizard.title')}
        description={t('importWizard.run', { run: runName })}
      />
      <form className={forms.section} noValidate onSubmit={(event) => void submit(event)}>
        <div className={forms.field}>
          <label htmlFor={fileId} className={forms.label}>
            {t('importWizard.file')}
          </label>
          <p id={`${fileId}-hint`} className={forms.hint}>
            {t('importWizard.fileHint')}
          </p>
          <input
            id={fileId}
            type="file"
            accept=".ris,.nbib,.txt,.bib,.csv,.tsv"
            aria-describedby={`${fileId}-hint`}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) void choose(chosen);
            }}
          />
        </div>

        <p role="status" className={busy ? forms.hint : 'visually-hidden'}>
          {busy === 'reading' && t('importWizard.reading')}
          {busy === 'importing' && t('importWizard.importing')}
        </p>

        {parsed && !parsed.format && (
          <p role="alert" className={`${notice.notice} ${notice.error}`}>
            {t('importWizard.unknownFormat')}
          </p>
        )}

        {parsed?.format && result && (
          <>
            <p className={notice.notice}>
              {t('importWizard.detected', {
                format: t(`formats.${parsed.format}`),
                count: number(count),
              })}
            </p>

            {result.csv && (
              <fieldset className={forms.fieldset}>
                <legend className={forms.legend}>{t('importWizard.mappingHeading')}</legend>
                <p className={forms.hint}>{t('importWizard.mappingHint')}</p>
                <div className={styles.mappingGrid}>
                  {MAPPED_FIELDS.map((field) => {
                    const csv = result.csv!;
                    const value = csv.mapping[field];
                    return (
                      <SelectField
                        key={field}
                        label={t(`csvFields.${field}`)}
                        required={field === 'title'}
                        value={value === undefined ? '' : String(value)}
                        options={[
                          { value: '', label: t('importWizard.notMapped') },
                          ...csv.headers.map((header, index) => ({
                            value: String(index),
                            label: header || `#${index + 1}`,
                          })),
                        ]}
                        onChange={(selected) => {
                          const next: CsvMapping = { ...csv.mapping };
                          if (selected === '') delete next[field];
                          else next[field] = Number(selected);
                          void remap(next);
                        }}
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}

            {result.warnings.length > 0 && (
              <div className={`${notice.notice} ${notice.warning}`}>
                <h2>{t('importWizard.warningsHeading', { count: result.warnings.length })}</h2>
                <ul className={styles.warningList}>
                  {result.warnings.slice(0, SHOWN_WARNINGS).map((warning, index) => (
                    <li key={index}>{warningText(warning)}</li>
                  ))}
                </ul>
                {result.warnings.length > SHOWN_WARNINGS && (
                  <p>
                    {t('importWizard.moreWarnings', {
                      count: result.warnings.length - SHOWN_WARNINGS,
                    })}
                  </p>
                )}
              </div>
            )}

            {count > 0 && (
              <div>
                <h2 className={forms.legend}>{t('importWizard.previewHeading')}</h2>
                <ol className={styles.preview}>
                  {result.records.slice(0, PREVIEW_RECORDS).map((record) => (
                    <li key={record.line}>{record.csl.title}</li>
                  ))}
                </ol>
              </div>
            )}

            <div>
              <h2 className={forms.legend}>{t('importWizard.reconciliation')}</h2>
              {run.reportedHits === undefined ? (
                <p className={forms.hint}>{t('importWizard.noReported')}</p>
              ) : (
                <dl className={styles.reconciliation}>
                  <div>
                    <dt>{t('importWizard.reportedHits')}</dt>
                    <dd>{number(run.reportedHits)}</dd>
                  </div>
                  <div>
                    <dt>{t('importWizard.alreadyImported')}</dt>
                    <dd>{number(alreadyImported)}</dd>
                  </div>
                  <div>
                    <dt>{t('importWizard.thisFile')}</dt>
                    <dd>{number(count)}</dd>
                  </div>
                  <div>
                    <dt>{t('importWizard.afterImport')}</dt>
                    <dd>{number(total)}</dd>
                  </div>
                </dl>
              )}
            </div>

            {mismatch && (
              <>
                <p className={`${notice.notice} ${notice.warning}`}>{t('importWizard.mismatch')}</p>
                {fewer && (
                  <label className={forms.radioOption}>
                    <input
                      type="checkbox"
                      checked={moreFiles}
                      onChange={(event) => setMoreFiles(event.target.checked)}
                    />
                    {t('importWizard.moreFiles')}
                  </label>
                )}
                <TextField
                  id="import-note"
                  label={t('importWizard.noteLabel')}
                  required={importNoteRequired(run.reportedHits, total, moreFiles)}
                  multiline
                  rows={2}
                  value={note}
                  error={submitted && noteMissing ? t('importWizard.noteRequired') : undefined}
                  onChange={setNote}
                />
              </>
            )}

            <div className={forms.actions}>
              <button
                type="submit"
                className={`${button.button} ${button.primary}`}
                aria-disabled={count === 0 || busy !== undefined || undefined}
              >
                {t('importWizard.submit', { count })}
              </button>
              <Link to={importPaths.page(projectId)} className={button.button}>
                {t('common.cancel')}
              </Link>
            </div>
          </>
        )}
      </form>
    </>
  );
}
