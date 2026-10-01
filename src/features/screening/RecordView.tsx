import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../app/format';
import { recordLinks } from '../../domain/screening/links';
import type { ScreeningUnit } from '../../domain/screening/units';
import type { ScreeningSettings } from '../../domain/types';
import { recordSummary } from './display';
import { Highlighted } from './Highlighted';
import styles from './Screening.module.css';
import type { ScreeningData } from './useScreening';

interface Props {
  data: ScreeningData;
  unit: ScreeningUnit;
  highlights: ScreeningSettings['highlights'];
  highlight: boolean;
}

/** The primary record of a unit, with highlighting, links and provenance of all members. */
export const RecordView = forwardRef<HTMLHeadingElement, Props>(function RecordView(
  { data, unit, highlights, highlight },
  titleRef,
) {
  const { t, i18n } = useTranslation();
  const record = data.records.get(unit.primaryId);
  const summary = recordSummary(record);
  const links = recordLinks({ doi: record?.doi, pmid: record?.pmid });
  const hasTerms = highlight && (highlights.include.length > 0 || highlights.exclude.length > 0);

  return (
    <article aria-labelledby="record-title" className={styles.record}>
      <h2 id="record-title" ref={titleRef} tabIndex={-1} className={styles.recordTitle}>
        <Highlighted
          text={summary.title || t('screening.untitled')}
          terms={highlights}
          enabled={highlight}
        />
      </h2>
      <dl className={styles.meta}>
        <div>
          <dt>{t('screening.fields.authors')}</dt>
          <dd>{summary.authors || '–'}</dd>
        </div>
        <div>
          <dt>{t('screening.fields.year')}</dt>
          <dd>{summary.year ?? '–'}</dd>
        </div>
        <div>
          <dt>{t('screening.fields.container')}</dt>
          <dd>{summary.container || '–'}</dd>
        </div>
      </dl>
      {hasTerms && (
        <p className={styles.legend}>
          <span>{t('screening.legend.label')}</span>{' '}
          <mark className={styles.include}>{t('screening.legend.include')}</mark>{' '}
          <mark className={styles.exclude}>{t('screening.legend.exclude')}</mark>
        </p>
      )}
      <section aria-labelledby="record-abstract" className={styles.abstract}>
        <h3 id="record-abstract" className="visually-hidden">
          {t('screening.fields.abstract')}
        </h3>
        {summary.abstract ? (
          <p>
            <Highlighted text={summary.abstract} terms={highlights} enabled={highlight} />
          </p>
        ) : (
          <p className={styles.muted}>{t('screening.noAbstract')}</p>
        )}
      </section>
      {(links.doi || links.pubmed) && (
        <ul className={styles.links} aria-label={t('screening.links.label')}>
          {links.doi && (
            <li>
              <a href={links.doi} target="_blank" rel="noreferrer">
                {t('screening.links.doi', { doi: record?.doi })}
              </a>
            </li>
          )}
          {links.unpaywall && (
            <li>
              <a href={links.unpaywall} target="_blank" rel="noreferrer">
                {t('screening.links.unpaywall')}
              </a>
            </li>
          )}
          {links.openAlex && (
            <li>
              <a href={links.openAlex} target="_blank" rel="noreferrer">
                {t('screening.links.openAlex')}
              </a>
            </li>
          )}
          {links.pubmed && (
            <li>
              <a href={links.pubmed} target="_blank" rel="noreferrer">
                {t('screening.links.pubmed', { pmid: record?.pmid })}
              </a>
            </li>
          )}
        </ul>
      )}
      <details className={styles.provenance}>
        <summary>{t('screening.provenance.summary', { count: unit.memberIds.length })}</summary>
        <ul>
          {unit.memberIds.map((id) => {
            const member = data.records.get(id);
            const run = member && data.runs.get(member.sourceRunId);
            const source = run && data.sources.get(run.sourceId);
            const batch = member && data.batches.get(member.importBatchId);
            return (
              <li key={id}>
                {[
                  source?.name,
                  run && formatDate(run.date, i18n.language),
                  batch?.fileName,
                  member?.sourceLine && t('screening.provenance.line', { line: member.sourceLine }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {id === unit.primaryId && ` (${t('screening.provenance.primary')})`}
              </li>
            );
          })}
        </ul>
      </details>
    </article>
  );
});
