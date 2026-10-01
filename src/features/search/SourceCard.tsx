import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { deleteSource, RecordsExistError } from '../../db/searchRepository';
import { SOURCE_TYPE_CONFIG } from '../../domain/search/sourceTypes';
import {
  latestRunDate,
  limitsStatus,
  sortRuns,
  sourceLabel,
  type LimitsStatus,
} from '../../domain/search/summary';
import type { Source, SourceRun } from '../../domain/types';
import { formatDate, formatNumber } from '../../app/format';
import { searchPaths } from '../../app/modules';
import { nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';
import notice from '../../design/notice.module.css';
import styles from './SearchPage.module.css';

interface Props {
  source: Source;
  runs: SourceRun[];
  onDeleted: (message: string) => void;
}

/** First line of what a run documents: search string, description or seed documents. */
function runSummary(run: SourceRun): string {
  const text = run.searchString || run.description || run.seedDocuments || run.notes || '';
  return text.split('\n').find((line) => line.trim() !== '') ?? '';
}

export function SourceCard({ source, runs, onDeleted }: Props) {
  const { t, i18n } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState('');
  const label = sourceLabel(source);
  const last = latestRunDate(runs);
  const headingId = `source-${source.id}`;
  const hasLimits = SOURCE_TYPE_CONFIG[source.type].runFields.includes('limits');

  async function remove() {
    setConfirming(false);
    try {
      await deleteSource(db, source.id, nowIso());
      onDeleted(t('search.source.deleted', { source: label }));
    } catch (error) {
      if (!(error instanceof RecordsExistError)) throw error;
      setBlocked(t('search.source.deleteBlocked', { source: label, count: error.count }));
    }
  }

  return (
    <article aria-labelledby={headingId} className={styles.card}>
      <h3 id={headingId} className={styles.cardTitle}>
        {label}
      </h3>
      <dl className={styles.meta}>
        {source.platform && (
          <div>
            <dt>{t('search.platform')}</dt>
            <dd>{source.platform}</dd>
          </div>
        )}
        {source.url && (
          <div>
            <dt>{t('sourceForm.url')}</dt>
            <dd>
              <a href={source.url}>{source.url}</a>
            </dd>
          </div>
        )}
        <div>
          <dt>{t('search.lastSearch')}</dt>
          <dd>{last ? formatDate(last, i18n.language) : t('search.notSearched')}</dd>
        </div>
      </dl>

      {runs.length === 0 ? (
        <p className={styles.muted}>{t('search.runs.none')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              {t('search.runs.caption', { source: label })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('search.runs.date')}</th>
                <th scope="col" className={styles.number}>
                  {t('search.runs.hits')}
                </th>
                <th scope="col">{t('search.runs.content')}</th>
                {hasLimits && <th scope="col">{t('search.runs.limits')}</th>}
                <th scope="col">
                  <span className="visually-hidden">{t('search.runs.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortRuns(runs).map((run) => {
                const date = run.dateTo
                  ? `${formatDate(run.date, i18n.language)} – ${formatDate(run.dateTo, i18n.language)}`
                  : formatDate(run.date, i18n.language);
                return (
                  <tr key={run.id}>
                    <td className={styles.nowrap}>{date}</td>
                    <td className={styles.number}>
                      {run.reportedHits === undefined
                        ? '–'
                        : formatNumber(run.reportedHits, i18n.language)}
                    </td>
                    <td className={run.searchString ? styles.codeCell : styles.textCell}>
                      {runSummary(run)}
                    </td>
                    {hasLimits && <LimitsCell status={limitsStatus(source.type, run)} />}
                    <td>
                      <Link to={searchPaths.run(source.projectId, run.id)}>
                        {t('common.edit')}
                        <span className="visually-hidden">
                          {` – ${t('search.runs.editFor', { date })}`}
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {blocked && <p className={`${notice.notice} ${notice.warning}`}>{blocked}</p>}

      <div className={styles.cardActions}>
        <Link
          to={searchPaths.newRun(source.projectId, source.id)}
          className={`${button.button} ${button.small}`}
        >
          {t('search.runs.add')}
          <span className="visually-hidden">{` – ${label}`}</span>
        </Link>
        <Link
          to={searchPaths.source(source.projectId, source.id)}
          className={`${button.button} ${button.small}`}
        >
          {t('search.source.edit')}
          <span className="visually-hidden">{` – ${label}`}</span>
        </Link>
        <button
          type="button"
          className={`${button.button} ${button.small} ${button.danger}`}
          onClick={() => {
            setBlocked('');
            setConfirming(true);
          }}
        >
          {t('search.source.delete')}
          <span className="visually-hidden">{` – ${label}`}</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('search.source.deleteTitle')}
        onCancel={() => setConfirming(false)}
        actions={[
          { label: t('common.deleteConfirm'), variant: 'danger', onSelect: () => void remove() },
        ]}
      >
        <p>{t('search.source.deleteBody', { source: label, count: runs.length })}</p>
      </ConfirmDialog>
    </article>
  );
}

function LimitsCell({ status }: { status: LimitsStatus | undefined }) {
  const { t } = useTranslation();
  if (status?.kind === 'text') return <td className={styles.textCell}>{status.text}</td>;
  if (status?.kind === 'none') return <td>{t('search.limits.none')}</td>;
  return <td className={styles.muted}>{t('search.limits.undocumented')}</td>;
}
