import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { db } from '../../db/db';
import { ScreeningExistsError, undoImport } from '../../db/importRepository';
import { reconcile } from '../../domain/import/reconcile';
import { groupSourcesByType, sortRuns, sourceLabel } from '../../domain/search/summary';
import type { ImportBatch, SourceRun } from '../../domain/types';
import { formatDate, formatDateTime, formatNumber } from '../../app/format';
import { importPaths, searchPaths } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';
import notice from '../../design/notice.module.css';
import { useProject } from '../project/useProject';
import { useSearchData } from '../search/useSearchData';
import { DedupSummary } from './DedupSummary';
import { recomputeDuplicates } from './dedupService';
import { useDedupPreview, useImportData } from './useImportData';
import styles from './Import.module.css';

/** Module 3: imports per search run, count check and entry to the duplicate review. */
export default function ImportPage() {
  const { t, i18n } = useTranslation();
  const project = useProject();
  const search = useSearchData(project.id);
  const data = useImportData(project.id);
  const preview = useDedupPreview(project.id);
  const location = useLocation();
  const [status, setStatus] = useState<string>(
    (location.state as { message?: string } | null)?.message ?? '',
  );
  const [toUndo, setToUndo] = useState<ImportBatch>();

  async function undo(batch: ImportBatch) {
    setToUndo(undefined);
    try {
      await undoImport(db, batch.id, nowIso());
      await recomputeDuplicates(project.id);
      setStatus(t('importPage.undone', { file: batch.fileName }));
    } catch (error) {
      if (!(error instanceof ScreeningExistsError)) throw error;
      setStatus(t('importPage.undoBlocked'));
    }
  }

  if (!search || !data) return <p>{t('common.loading')}</p>;
  const runLabel = (run: SourceRun) => {
    const source = search.sources.find((s) => s.id === run.sourceId);
    return `${source ? sourceLabel(source) : ''} – ${formatDate(run.date, i18n.language)}`;
  };

  return (
    <>
      <PageHeading
        title={t('modules.import.title')}
        description={t('modules.import.description')}
      />
      <p role="status" className={status ? notice.notice : 'visually-hidden'}>
        {status}
      </p>

      {search.runs.length === 0 ? (
        <p className={`${notice.notice} ${notice.warning}`}>
          {t('importPage.noRuns')}{' '}
          <Link to={searchPaths.page(project.id)}>{t('importPage.toSearch')}</Link>
        </p>
      ) : (
        <>
          <section aria-labelledby="dedup-heading" className={styles.section}>
            <h2 id="dedup-heading">{t('importPage.duplicatesHeading')}</h2>
            <DedupSummary result={preview} />
            <p>
              <Link to={importPaths.duplicates(project.id)} className={button.button}>
                {t('importPage.review')}
                {preview &&
                  preview.stats.openCandidates > 0 &&
                  ` (${preview.stats.openCandidates})`}
              </Link>
            </p>
          </section>

          <section aria-labelledby="runs-heading" className={styles.section}>
            <h2 id="runs-heading">{t('importPage.runsHeading')}</h2>
            {groupSourcesByType(search.sources).flatMap((group) =>
              group.sources.flatMap((source) =>
                sortRuns(search.runs.filter((run) => run.sourceId === source.id)).map((run) => {
                  const batches = data.batches
                    .filter((batch) => batch.sourceRunId === run.id)
                    .sort((a, b) => a.importedAt.localeCompare(b.importedAt));
                  const imported = batches.reduce((sum, batch) => sum + batch.recordCount, 0);
                  const state = reconcile(run, imported);
                  const label = runLabel(run);
                  return (
                    <article key={run.id} aria-labelledby={`run-${run.id}`} className={styles.card}>
                      <h3 id={`run-${run.id}`} className={styles.cardTitle}>
                        {label}
                      </h3>
                      <dl className={styles.meta}>
                        <div>
                          <dt>{t('importPage.reported')}</dt>
                          <dd>
                            {run.reportedHits === undefined
                              ? '–'
                              : formatNumber(run.reportedHits, i18n.language)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('importPage.imported')}</dt>
                          <dd>{formatNumber(imported, i18n.language)}</dd>
                        </div>
                      </dl>
                      <p
                        className={
                          state === 'mismatch' ? `${notice.notice} ${notice.warning}` : styles.muted
                        }
                      >
                        {state === 'justified'
                          ? t('importPage.status.justified', { note: run.importNote })
                          : t(`importPage.status.${state}`)}
                      </p>
                      {batches.length > 0 && (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <caption className="visually-hidden">
                              {t('importPage.batches.caption', { run: label })}
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">{t('importPage.batches.file')}</th>
                                <th scope="col">{t('importPage.batches.format')}</th>
                                <th scope="col">{t('importPage.batches.date')}</th>
                                <th scope="col" className={styles.number}>
                                  {t('importPage.batches.records')}
                                </th>
                                <th scope="col" className={styles.number}>
                                  {t('importPage.batches.warnings')}
                                </th>
                                <th scope="col">
                                  <span className="visually-hidden">
                                    {t('search.runs.actions')}
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {batches.map((batch) => (
                                <tr key={batch.id}>
                                  <td>{batch.fileName}</td>
                                  <td>{t(`formats.${batch.format}`)}</td>
                                  <td>{formatDateTime(batch.importedAt, i18n.language)}</td>
                                  <td className={styles.number}>
                                    {formatNumber(batch.recordCount, i18n.language)}
                                  </td>
                                  <td className={styles.number}>{batch.warnings.length}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className={`${button.button} ${button.small} ${button.danger}`}
                                      onClick={() => setToUndo(batch)}
                                    >
                                      {t('importPage.batches.undo')}
                                      <span className="visually-hidden">{` – ${batch.fileName}`}</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div>
                        <Link
                          to={importPaths.run(project.id, run.id)}
                          className={`${button.button} ${button.small}`}
                        >
                          {t('importPage.importFile')}
                          <span className="visually-hidden">{` – ${label}`}</span>
                        </Link>
                      </div>
                    </article>
                  );
                }),
              ),
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={toUndo !== undefined}
        title={t('importPage.undoTitle')}
        onCancel={() => setToUndo(undefined)}
        actions={[
          {
            label: t('importPage.undoConfirm'),
            variant: 'danger',
            onSelect: () => toUndo && void undo(toUndo),
          },
        ]}
      >
        <p>
          {t('importPage.undoBody', {
            count: toUndo?.recordCount ?? 0,
            file: toUndo?.fileName ?? '',
          })}
        </p>
      </ConfirmDialog>
    </>
  );
}
