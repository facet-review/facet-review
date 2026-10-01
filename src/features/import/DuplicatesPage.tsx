import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/db';
import { addDedupDecision } from '../../db/importRepository';
import type { Candidate, DedupGroupResult } from '../../domain/dedup/dedup';
import { TITLE_SIMILARITY_THRESHOLD } from '../../domain/dedup/dedup';
import { compareRecords, diffWords } from '../../domain/dedup/compare';
import { sourceLabel } from '../../domain/search/summary';
import type { BibRecord, DedupDecision, UUID } from '../../domain/types';
import { formatDate } from '../../app/format';
import { PageHeading } from '../../app/PageHeading';
import { newId, nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import notice from '../../design/notice.module.css';
import { useProject } from '../project/useProject';
import { useSearchData } from '../search/useSearchData';
import { DedupSummary } from './DedupSummary';
import { recomputeDuplicates } from './dedupService';
import { useDedupPreview, useImportData } from './useImportData';
import styles from './Import.module.css';

type Status = { message: string; undo?: [UUID, UUID] };

/** Review of duplicate candidates and merged groups. Every action is a stored decision. */
export default function DuplicatesPage() {
  const { t, i18n } = useTranslation();
  const project = useProject();
  const data = useImportData(project.id);
  const search = useSearchData(project.id);
  const result = useDedupPreview(project.id);
  const [status, setStatus] = useState<Status>();
  /** Focus target after a decision: applied once a result no longer lists the decided pair. */
  const pendingFocus = useRef<{ index: number; pair: [UUID, UUID] } | undefined>(undefined);
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  const candidatesHeading = useRef<HTMLHeadingElement>(null);
  const reviewerId = project.reviewers[0]?.id ?? 'unknown';

  // After a decision, move focus to the next candidate (or the section heading) –
  // but only with a result that already reflects the decision (worker results can
  // arrive from computations started before it).
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || !result) return;
    const [a, b] = pending.pair;
    if (result.candidates.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a))) return;
    pendingFocus.current = undefined;
    const target = headings.current[Math.min(pending.index, result.candidates.length - 1)];
    (target ?? candidatesHeading.current)?.focus();
  }, [result]);

  if (!data || !search || !result) {
    return (
      <>
        <PageHeading title={t('duplicates.title')} description={t('duplicates.description')} />
        <p role="status">{t('dedupStats.computing')}</p>
      </>
    );
  }

  const records = new Map(data.records.map((record) => [record.id, record]));
  const titleOf = (id: UUID) => records.get(id)?.csl.title ?? id;
  const origin = (record: BibRecord) => {
    const run = search.runs.find((r) => r.id === record.sourceRunId);
    const source = search.sources.find((s) => s.id === run?.sourceId);
    const batch = data.batches.find((b) => b.id === record.importBatchId);
    return t('duplicates.origin', {
      source: source ? sourceLabel(source) : '',
      date: run ? formatDate(run.date, i18n.language) : '',
      file: batch?.fileName ?? '',
      line: record.sourceLine ?? '–',
    });
  };

  async function decide(value: DedupDecision['value'], recordIds: UUID[]) {
    const decision: DedupDecision = {
      id: newId(),
      projectId: project.id,
      recordIds,
      value,
      reviewerId,
      timestamp: nowIso(),
    };
    await addDedupDecision(db, decision, nowIso());
    await recomputeDuplicates(project.id);
  }

  async function decideCandidate(candidate: Candidate, index: number, value: 'merge' | 'separate') {
    pendingFocus.current = { index, pair: [candidate.a, candidate.b] };
    await decide(value, [candidate.a, candidate.b]);
    setStatus({
      message: t(value === 'merge' ? 'duplicates.merged' : 'duplicates.keptApart', {
        title: titleOf(candidate.a),
      }),
      undo: [candidate.a, candidate.b],
    });
  }

  async function undo(pair: [UUID, UUID]) {
    await decide('reset', pair);
    setStatus({ message: t('duplicates.undone') });
  }

  const percent = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(
      value,
    );

  return (
    <>
      <PageHeading title={t('duplicates.title')} description={t('duplicates.description')} />
      <DedupSummary result={result} />
      <div
        role="status"
        className={status ? `${notice.notice} ${styles.statusBar}` : 'visually-hidden'}
      >
        {status?.message}{' '}
        {status?.undo && (
          <button
            type="button"
            className={`${button.button} ${button.small}`}
            onClick={() => void undo(status.undo!)}
          >
            {t('duplicates.undo')}
          </button>
        )}
      </div>

      <section aria-labelledby="candidates-heading" className={styles.section}>
        <h2
          id="candidates-heading"
          ref={candidatesHeading}
          tabIndex={-1}
          className={styles.cardTitle}
        >
          {t('duplicates.candidatesHeading', { count: result.candidates.length })}
        </h2>
        {result.candidates.length === 0 && (
          <p className={styles.muted}>{t('duplicates.noCandidates')}</p>
        )}
        {result.candidates.map((candidate, index) => {
          const a = records.get(candidate.a);
          const b = records.get(candidate.b);
          if (!a || !b) return null;
          const n = index + 1;
          const headingId = `candidate-${candidate.a}-${candidate.b}`;
          const rows = compareRecords(a, b);
          const { years, sameFirstAuthor, doiConflict } = candidate.reasons;
          const reasons = [
            t('duplicates.reason', {
              score: percent(candidate.score),
              threshold: percent(TITLE_SIMILARITY_THRESHOLD),
            }),
            sameFirstAuthor ? t('duplicates.sameAuthor') : t('duplicates.authorUnknown'),
            t('duplicates.years', { a: years[0] ?? '–', b: years[1] ?? '–' }),
          ].join(' · ');
          return (
            <article key={headingId} aria-labelledby={headingId} className={styles.card}>
              <h3
                id={headingId}
                ref={(el) => {
                  headings.current[index] = el;
                }}
                tabIndex={-1}
                className={styles.cardTitle}
              >
                {t('duplicates.candidate', { n, total: result.candidates.length })}
              </h3>
              <p className={styles.muted}>{reasons}</p>
              {doiConflict && (
                <p className={`${notice.notice} ${notice.warning}`}>
                  {t('duplicates.doiConflict')}
                </p>
              )}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className="visually-hidden">
                    {t('duplicates.compareCaption', { n })}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('duplicates.field')}</th>
                      <th scope="col">{t('duplicates.recordA')}</th>
                      <th scope="col">{t('duplicates.recordB')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field} className={row.differs ? styles.differs : undefined}>
                        <th scope="row">
                          {t(`duplicates.fields.${row.field}`)}
                          {row.differs && (
                            <span className={styles.differsMark}>
                              {' '}
                              ≠ <span className="visually-hidden">{t('duplicates.differs')}</span>
                            </span>
                          )}
                        </th>
                        {row.field === 'title' ? (
                          <>
                            <td>
                              <Highlighted text={row.a} other={row.b} />
                            </td>
                            <td>
                              <Highlighted text={row.b} other={row.a} />
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{row.a || '–'}</td>
                            <td>{row.b || '–'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">{t('duplicates.fields.origin')}</th>
                      <td>{origin(a)}</td>
                      <td>{origin(b)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${button.button} ${button.primary}`}
                  onClick={() => void decideCandidate(candidate, index, 'merge')}
                >
                  {t('duplicates.merge')}
                  <span className="visually-hidden">{` – ${t('duplicates.candidate', { n, total: result.candidates.length })}`}</span>
                </button>
                <button
                  type="button"
                  className={button.button}
                  onClick={() => void decideCandidate(candidate, index, 'separate')}
                >
                  {t('duplicates.keepApart')}
                  <span className="visually-hidden">{` – ${t('duplicates.candidate', { n, total: result.candidates.length })}`}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="groups-heading" className={styles.section}>
        <h2 id="groups-heading">
          {t('duplicates.groupsHeading', { count: result.groups.length })}
        </h2>
        {result.groups.length === 0 && <p className={styles.muted}>{t('duplicates.noGroups')}</p>}
        {result.groups.map((group) => (
          <GroupDetails
            key={group.primaryRecordId}
            group={group}
            records={records}
            origin={origin}
            onPrimary={(id) => void decide('primary', [id])}
            onDetach={(id) =>
              void (async () => {
                for (const other of group.memberIds.filter((m) => m !== id)) {
                  await decide('separate', [id, other]);
                }
              })()
            }
          />
        ))}
      </section>

      <section aria-labelledby="separated-heading" className={styles.section}>
        <h2 id="separated-heading">
          {t('duplicates.separatedHeading', { count: result.separated.length })}
        </h2>
        {result.separated.length === 0 ? (
          <p className={styles.muted}>{t('duplicates.noSeparated')}</p>
        ) : (
          <ul className={styles.pairList}>
            {result.separated.map(({ a, b }) => (
              <li key={`${a}|${b}`}>
                <span>
                  {titleOf(a)} ≠ {titleOf(b)}
                </span>{' '}
                <button
                  type="button"
                  className={`${button.button} ${button.small}`}
                  onClick={() => void decide('reset', [a, b])}
                >
                  {t('duplicates.reconsider')}
                  <span className="visually-hidden">{` – ${titleOf(a)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Highlighted({ text, other }: { text: string; other: string }) {
  return (
    <>
      {diffWords(text, other).map((part, index) =>
        part.changed ? (
          <mark key={index} className={styles.changed}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

interface GroupProps {
  group: DedupGroupResult;
  records: Map<UUID, BibRecord>;
  origin: (record: BibRecord) => string;
  onPrimary: (id: UUID) => void;
  onDetach: (id: UUID) => void;
}

function GroupDetails({ group, records, origin, onPrimary, onDetach }: GroupProps) {
  const { t } = useTranslation();
  const primary = records.get(group.primaryRecordId);
  const titleOf = (id: UUID) => records.get(id)?.csl.title ?? id;
  return (
    <details className={styles.card}>
      <summary>
        {t('duplicates.groupSummary', {
          title: primary?.csl.title ?? '',
          rule: t(`duplicates.rules.${group.rule}`),
          count: group.memberIds.length,
        })}
      </summary>
      <ul className={styles.muted}>
        {group.links.map((link) => (
          <li key={`${link.a}|${link.b}`}>
            {t('duplicates.linkExplanation', {
              a: titleOf(link.a),
              b: titleOf(link.b),
              rule: t(`duplicates.rules.${link.rule}`),
            })}
          </li>
        ))}
      </ul>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">{t('duplicates.membersCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('duplicates.fields.title')}</th>
              <th scope="col">{t('duplicates.fields.origin')}</th>
              <th scope="col">{t('duplicates.fields.doi')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('search.runs.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.memberIds.map((id) => {
              const record = records.get(id);
              if (!record) return null;
              const isPrimary = id === group.primaryRecordId;
              return (
                <tr key={id}>
                  <td>
                    {record.csl.title}
                    {isPrimary && <strong> ({t('duplicates.primary')})</strong>}
                  </td>
                  <td>{origin(record)}</td>
                  <td>{record.doi ?? record.pmid ?? '–'}</td>
                  <td className={styles.actions}>
                    {!isPrimary && (
                      <button
                        type="button"
                        className={`${button.button} ${button.small}`}
                        onClick={() => onPrimary(id)}
                      >
                        {t('duplicates.makePrimary')}
                        <span className="visually-hidden">{` – ${record.csl.title ?? ''}`}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${button.button} ${button.small} ${button.danger}`}
                      onClick={() => onDetach(id)}
                    >
                      {t('duplicates.detach')}
                      <span className="visually-hidden">{` – ${record.csl.title ?? ''}`}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
