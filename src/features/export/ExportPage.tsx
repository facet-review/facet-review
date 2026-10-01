import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { projectPath } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { listChecklist } from '../../db/checklistRepository';
import { db } from '../../db/db';
import { listScreeningData } from '../../db/screeningRepository';
import button from '../../design/button.module.css';
import notice from '../../design/notice.module.css';
import { toCsv } from '../../domain/export/csv';
import { includedRis, includedRows, recordRows } from '../../domain/export/data';
import { appendixMarkdown, searchAppendix } from '../../domain/export/searchAppendix';
import type { FlowInput } from '../../domain/flow/computeFlow';
import { computeFlow } from '../../domain/flow/computeFlow';
import { ChecklistPdfButton } from '../checklist/ChecklistPdfButton';
import { download } from '../flow/exportFlow';
import { exportProject } from '../project/projectFileIO';
import { useProject } from '../project/useProject';
import { CsvDelimiterField } from './CsvDelimiterField';
import styles from './Export.module.css';
import { exportFileName } from './files';
import { appendixLabels, exportLabels } from './labels';
import { appendixPdf } from './pdf';
import { useCsvDelimiter } from './useCsvDelimiter';

export default function ExportPage() {
  const { t } = useTranslation();
  const project = useProject();
  const data = useLiveQuery(() => listScreeningData(db, project.id), [project.id]);
  const entries = useLiveQuery(() => listChecklist(db, project.id), [project.id]);

  return (
    <>
      <PageHeading
        title={t('modules.export.title')}
        description={t('modules.export.description')}
      />
      {!data?.project || !entries ? (
        <p>{t('common.loading')}</p>
      ) : (
        <Exports
          input={{
            ...data,
            project: data.project,
            sourceRuns: data.runs,
            importBatches: data.batches,
            duplicateGroups: data.groups,
          }}
          entries={entries}
        />
      )}
    </>
  );
}

function Exports({
  input,
  entries,
}: {
  input: FlowInput;
  entries: Awaited<ReturnType<typeof listChecklist>>;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [delimiter, setDelimiter] = useCsvDelimiter();
  const projectId = input.project.id;
  const counts = computeFlow(input);
  const hasRecords = input.records.length > 0;
  const hasRuns = input.sourceRuns.length > 0;
  const hasIncluded = counts.reports.n > 0;
  const done = (file: string) => setMessage(t('export.done', { file }));

  const appendix = () => searchAppendix(input);
  const appendixFooter = () => [t('export.appendix.source2021'), t('export.appendix.license')];

  return (
    <div className={styles.page}>
      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>

      <Group id="export-project" title={t('export.project.title')} hint={t('export.project.hint')}>
        <button
          type="button"
          className={button.button}
          onClick={() => void exportProject(projectId).then(() => done('JSON'))}
        >
          {t('export.project.button')}
        </button>
      </Group>

      <Group
        id="export-appendix"
        title={t('export.appendixGroup.title')}
        hint={t('export.appendixGroup.hint')}
        missing={hasRuns ? undefined : t('export.appendixGroup.missing')}
      >
        <button
          type="button"
          className={button.button}
          aria-disabled={!hasRuns || undefined}
          onClick={
            hasRuns
              ? () =>
                  void appendixPdf({
                    model: appendix(),
                    label: appendixLabels(t),
                    footer: appendixFooter(),
                    language: t('export.languageCode'),
                    pageLabel: (page, total) => t('checklist.pdf.page', { page, total }),
                  }).then((blob) => {
                    download(blob, exportFileName('search-appendix', 'pdf'), 'application/pdf');
                    done('PDF');
                  })
              : undefined
          }
        >
          {t('export.appendixGroup.pdf')}
        </button>
        <button
          type="button"
          className={button.button}
          aria-disabled={!hasRuns || undefined}
          onClick={
            hasRuns
              ? () => {
                  download(
                    appendixMarkdown(appendix(), appendixLabels(t)),
                    exportFileName('search-appendix', 'md'),
                    'text/markdown;charset=utf-8',
                  );
                  done('Markdown');
                }
              : undefined
          }
        >
          {t('export.appendixGroup.markdown')}
        </button>
      </Group>

      <Group
        id="export-checklist"
        title={t('export.checklistGroup.title')}
        hint={t('export.checklistGroup.hint')}
      >
        <ChecklistPdfButton
          entries={entries}
          projectTitle={input.project.title}
          onDone={setMessage}
        />
      </Group>

      <Group id="export-flow" title={t('export.flowGroup.title')} hint={t('export.flowGroup.hint')}>
        <Link to={projectPath(projectId, 'flow')}>{t('export.flowGroup.link')}</Link>
      </Group>

      <section aria-labelledby="export-csv" className={styles.group}>
        <h2 id="export-csv">{t('export.csvHeading')}</h2>
        <div className={styles.delimiter}>
          <CsvDelimiterField id="export-delimiter" value={delimiter} onChange={setDelimiter} />
        </div>
      </section>

      <Group
        id="export-included"
        title={t('export.included.title')}
        hint={t('export.included.hint', { reports: counts.reports.n, studies: counts.studies.n })}
        missing={hasIncluded ? undefined : t('export.included.missing')}
      >
        <button
          type="button"
          className={button.button}
          aria-disabled={!hasIncluded || undefined}
          onClick={
            hasIncluded
              ? () => {
                  download(
                    includedRis(input, exportLabels(t)),
                    exportFileName('included', 'ris'),
                    'application/x-research-info-systems;charset=utf-8',
                  );
                  done('RIS');
                }
              : undefined
          }
        >
          {t('export.included.ris')}
        </button>
        <button
          type="button"
          className={button.button}
          aria-disabled={!hasIncluded || undefined}
          onClick={
            hasIncluded
              ? () => {
                  download(
                    toCsv(includedRows(input, exportLabels(t)), delimiter),
                    exportFileName('included', 'csv'),
                    'text/csv;charset=utf-8',
                  );
                  done('CSV');
                }
              : undefined
          }
        >
          {t('export.included.csv')}
        </button>
      </Group>

      <Group
        id="export-records"
        title={t('export.records.title')}
        hint={t('export.records.hint', { count: input.records.length })}
        missing={hasRecords ? undefined : t('export.records.missing')}
      >
        <button
          type="button"
          className={button.button}
          aria-disabled={!hasRecords || undefined}
          onClick={
            hasRecords
              ? () => {
                  download(
                    toCsv(recordRows(input, exportLabels(t)), delimiter),
                    exportFileName('records', 'csv'),
                    'text/csv;charset=utf-8',
                  );
                  done('CSV');
                }
              : undefined
          }
        >
          {t('export.records.csv')}
        </button>
      </Group>
    </div>
  );
}

function Group({
  id,
  title,
  hint,
  missing,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  missing?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.group}>
      <h2 id={id}>{title}</h2>
      <p className={styles.hint}>{hint}</p>
      {missing && <p className={`${notice.notice} ${notice.warning}`}>{missing}</p>}
      <div className={styles.actions}>{children}</div>
    </section>
  );
}
