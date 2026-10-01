import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SOURCE_TYPE_CONFIG, type FlowColumn } from '../../domain/search/sourceTypes';
import { groupSourcesByType, reportedHitsByColumn } from '../../domain/search/summary';
import { formatNumber } from '../../app/format';
import { searchPaths } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import button from '../../design/button.module.css';
import { useProject } from '../project/useProject';
import { SearchMetaSection } from './SearchMetaSection';
import { SourceCard } from './SourceCard';
import { useSearchData } from './useSearchData';
import styles from './SearchPage.module.css';

const FLOW_COLUMNS: readonly FlowColumn[] = ['databases_registers', 'other_methods'];

/** Module 2: documentation of all sources and search runs (PRISMA-S). */
export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const project = useProject();
  const data = useSearchData(project.id);
  const [status, setStatus] = useState('');

  return (
    <>
      <PageHeading
        title={t('modules.search.title')}
        description={t('modules.search.description')}
      />
      <div className={styles.actions}>
        <Link
          to={searchPaths.newSource(project.id)}
          className={`${button.button} ${button.primary}`}
        >
          {t('search.addSource')}
        </Link>
        <Link to={searchPaths.openAlex(project.id)} className={button.button}>
          {t('openalex.button')}
        </Link>
      </div>
      <p role="status" className={styles.status}>
        {status}
      </p>

      {data === undefined ? (
        <p>{t('common.loading')}</p>
      ) : data.sources.length === 0 ? (
        <p>{t('search.empty')}</p>
      ) : (
        <>
          <Summary sources={data.sources} runs={data.runs} language={i18n.language} />
          {groupSourcesByType(data.sources).map((group) => (
            <section
              key={group.type}
              aria-labelledby={`group-${group.type}`}
              className={styles.group}
            >
              <h2 id={`group-${group.type}`} className={styles.groupHeading}>
                {t(`sourceTypes.${group.type}.group`)}{' '}
                <span className={styles.prismaS}>
                  {t('search.prismaS', {
                    items: SOURCE_TYPE_CONFIG[group.type].prismaS.join(', '),
                  })}
                </span>
              </h2>
              {group.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  runs={data.runs.filter((run) => run.sourceId === source.id)}
                  onDeleted={setStatus}
                />
              ))}
            </section>
          ))}
        </>
      )}

      <SearchMetaSection key={project.id} project={project} />
    </>
  );
}

function Summary({
  sources,
  runs,
  language,
}: {
  sources: Parameters<typeof reportedHitsByColumn>[0];
  runs: Parameters<typeof reportedHitsByColumn>[1];
  language: string;
}) {
  const { t } = useTranslation();
  const hits = reportedHitsByColumn(sources, runs);
  return (
    <div className={styles.summary}>
      <p>
        {t('search.summarySources', { count: sources.length })} ·{' '}
        {t('search.summaryRuns', { count: runs.length })}
      </p>
      {FLOW_COLUMNS.map((column) => (
        <p key={column}>
          {t(`search.hits.${column}`, { hits: formatNumber(hits[column].hits, language) })}
          {hits[column].runsWithoutHits > 0 &&
            ` ${t('search.hits.missing', { count: hits[column].runsWithoutHits })}`}
        </p>
      ))}
    </div>
  );
}
