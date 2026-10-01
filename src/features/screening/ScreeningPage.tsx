import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { formatNumber } from '../../app/format';
import { importPaths, screeningPaths, type StageSlug } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import button from '../../design/button.module.css';
import notice from '../../design/notice.module.css';
import { ToggleGroup } from '../../design/ToggleGroup';
import {
  fullTextGate,
  stageItems,
  stageProgress,
  type StageFilter,
} from '../../domain/screening/stages';
import { parseFilter, STAGE_FILTERS } from './filters';
import { includedCounts } from '../../domain/screening/studies';
import type { ScreeningStage } from '../../domain/types';
import { useDedupPreview } from '../import/useImportData';
import { useProject } from '../project/useProject';
import { recordSummary } from './display';
import styles from './Screening.module.css';
import { ScreeningSettingsSection } from './ScreeningSettingsSection';
import { StatusLabel } from './StatusLabel';
import { SLUG_OF_STAGE, STAGE_OF_SLUG, useScreening, type ScreeningData } from './useScreening';

const PAGE_SIZE = 100;
const STAGES: readonly ScreeningStage[] = ['title_abstract', 'full_text'];

export default function ScreeningPage() {
  const { t } = useTranslation();
  const project = useProject();
  const data = useScreening(project.id);
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <>
      <PageHeading
        title={t('modules.screening.title')}
        description={t('modules.screening.description')}
      />
      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>
      {data === undefined ? (
        <p>{t('common.loading')}</p>
      ) : data.evaluated.length === 0 ? (
        <p className={notice.notice}>
          {t('screening.noRecords')}{' '}
          <Link to={importPaths.page(project.id)}>{t('screening.toImport')}</Link>
        </p>
      ) : (
        <ScreeningOverview data={data} />
      )}
    </>
  );
}

function ScreeningOverview({ data }: { data: ScreeningData }) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const stageSlug: StageSlug = params.get('stage') === 'full-text' ? 'full-text' : 'title-abstract';
  const stage = STAGE_OF_SLUG[stageSlug];
  const filter = parseFilter(params.get('filter'), stage);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const dedup = useDedupPreview(data.project.id);
  const projectId = data.project.id;

  const gate = fullTextGate(data.evaluated, data.project.screening);
  const removed = data.evaluated.filter((s) => s.removed);
  const number = (n: number) => formatNumber(n, i18n.language);

  return (
    <>
      {dedup && dedup.stats.openCandidates > 0 && (
        <p className={`${notice.notice} ${notice.warning}`}>
          {t('screening.openCandidates', { count: dedup.stats.openCandidates })}{' '}
          <Link to={importPaths.duplicates(projectId)}>{t('screening.toDuplicates')}</Link>
        </p>
      )}

      <nav aria-label={t('screening.stages')} className={styles.tabs}>
        {STAGES.map((s) => {
          const progress = stageProgress(data.evaluated, s);
          return (
            <Link
              key={s}
              to={screeningPaths.page(projectId, SLUG_OF_STAGE[s])}
              aria-current={s === stage ? 'page' : undefined}
              className={styles.tab}
            >
              {t(`screening.stage.${s}`)}
              <span className={styles.tabCount}>
                {t('screening.decidedOf', {
                  decided: number(progress.decided),
                  total: number(progress.total),
                })}
              </span>
            </Link>
          );
        })}
      </nav>

      {stage === 'full_text' && gate.locked ? (
        <div className={`${notice.notice} ${notice.warning}`}>
          <p>{t('screening.gate.locked', { count: gate.maybes })}</p>
          <p>
            <Link to={screeningPaths.page(projectId, 'title-abstract', 'maybe')}>
              {t('screening.gate.showMaybes')}
            </Link>
          </p>
          <p>{t('screening.gate.setting')}</p>
        </div>
      ) : (
        <StageSection
          data={data}
          stage={stage}
          filter={filter}
          limit={limit}
          onFilter={(next) => {
            setLimit(PAGE_SIZE);
            setParams(
              (current) => {
                const updated = new URLSearchParams(current);
                if (next === 'all') updated.delete('filter');
                else updated.set('filter', next);
                return updated;
              },
              { replace: true },
            );
          }}
          onMore={() => setLimit((n) => n + PAGE_SIZE)}
          openTitleAbstract={gate.openTitleAbstract}
        />
      )}

      {removed.length > 0 && (
        <section aria-labelledby="removed-heading" className={styles.section}>
          <h2 id="removed-heading">{t('screening.removed.heading', { count: removed.length })}</h2>
          <ul className={styles.plainList}>
            {removed.map((s) => (
              <li key={s.unit.key}>
                <Link to={screeningPaths.unit(projectId, 'title-abstract', s.unit.primaryId)}>
                  {recordSummary(data.records.get(s.unit.primaryId)).title ||
                    t('screening.untitled')}
                </Link>{' '}
                – {t(`screening.value.${s.removal.decision?.value ?? 'remove_other'}`)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ScreeningSettingsSection project={data.project} />
    </>
  );
}

interface StageSectionProps {
  data: ScreeningData;
  stage: ScreeningStage;
  filter: StageFilter;
  limit: number;
  onFilter: (filter: StageFilter) => void;
  onMore: () => void;
  openTitleAbstract: number;
}

function StageSection({
  data,
  stage,
  filter,
  limit,
  onFilter,
  onMore,
  openTitleAbstract,
}: StageSectionProps) {
  const { t, i18n } = useTranslation();
  const projectId = data.project.id;
  const slug = SLUG_OF_STAGE[stage];
  const progress = stageProgress(data.evaluated, stage);
  const items = stageItems(data.evaluated, stage, filter);
  const firstOpen = stageItems(data.evaluated, stage, 'open')[0];
  const number = (n: number) => formatNumber(n, i18n.language);
  const counts = includedCounts(data.evaluated);
  const headingId = `stage-${slug}`;

  const stats: [string, number][] =
    stage === 'title_abstract'
      ? [
          [t('screening.filter.include'), progress.counts.include],
          [t('screening.filter.exclude'), progress.counts.exclude],
          [t('screening.filter.maybe'), progress.counts.maybe],
          [t('screening.filter.open'), progress.open],
          [t('screening.filter.conflict'), progress.conflicts],
          [t('screening.filter.review'), progress.review],
        ]
      : [
          [t('screening.filter.include'), progress.counts.include],
          [t('screening.studies'), counts.studies],
          [t('screening.filter.exclude'), progress.counts.exclude],
          [t('screening.filter.not_retrieved'), progress.counts.not_retrieved],
          [t('screening.filter.open'), progress.open],
          [t('screening.filter.conflict'), progress.conflicts],
        ];

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId}>{t(`screening.stage.${stage}`)}</h2>
      {stage === 'full_text' && openTitleAbstract > 0 && (
        <p className={`${notice.notice} ${notice.warning}`}>
          {t('screening.gate.openWarning', { count: openTitleAbstract })}
        </p>
      )}
      <div className={styles.progress}>
        <label htmlFor={`progress-${slug}`}>
          {t('screening.progress', {
            decided: number(progress.decided),
            total: number(progress.total),
          })}
        </label>
        <progress id={`progress-${slug}`} value={progress.decided} max={progress.total || 1} />
      </div>
      <dl className={styles.stats}>
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{number(value)}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.actions}>
        {firstOpen ? (
          <Link
            className={`${button.button} ${button.primary}`}
            to={screeningPaths.unit(projectId, slug, firstOpen.unit.primaryId, 'open')}
          >
            {progress.decided === 0 ? t('screening.start') : t('screening.continue')}
          </Link>
        ) : (
          progress.total > 0 && <span>{t('screening.allDecided')}</span>
        )}
      </p>

      <ToggleGroup
        label={t('screening.filterLabel')}
        options={STAGE_FILTERS[stage].map((value) => ({
          value,
          label: t(`screening.filter.${value}`),
        }))}
        value={filter}
        onChange={onFilter}
      />

      {items.length === 0 ? (
        <p className={styles.muted}>{t('screening.emptyFilter')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              {t('screening.listCaption', {
                stage: t(`screening.stage.${stage}`),
                filter: t(`screening.filter.${filter}`),
              })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('screening.columns.title')}</th>
                <th scope="col">{t('screening.columns.authors')}</th>
                <th scope="col">{t('screening.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, limit).map((s) => {
                const summary = recordSummary(data.records.get(s.unit.primaryId));
                return (
                  <tr key={s.unit.key}>
                    <td>
                      <Link to={screeningPaths.unit(projectId, slug, s.unit.primaryId, filter)}>
                        {summary.title || t('screening.untitled')}
                      </Link>
                    </td>
                    <td className={styles.authors}>
                      {[summary.firstAuthor, summary.year].filter(Boolean).join(' ')}
                    </td>
                    <td>
                      <StatusLabel
                        status={stage === 'title_abstract' ? s.titleAbstract : s.fullText}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {items.length > limit && (
        <p>
          <button type="button" className={button.button} onClick={onMore}>
            {t('screening.more', { count: Math.min(PAGE_SIZE, items.length - limit) })}
          </button>
        </p>
      )}
    </section>
  );
}
