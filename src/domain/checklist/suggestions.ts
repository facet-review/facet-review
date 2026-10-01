import { formatAuthors } from '../dedup/compare';
import { computeFlow, type FlowInput } from '../flow/computeFlow';
import { yearOf } from '../import/normalize';
import { latestRunDate, sourceLabel } from '../search/summary';
import type { Suggestion } from './adopt';

export type SuggestionKey =
  | 'eligibility.inclusion'
  | 'eligibility.exclusion'
  | 'eligibility.none'
  | 'sources.line'
  | 'sources.none'
  | 'appendix.note'
  | 'appendix.location'
  | 'selection.single'
  | 'selection.automation'
  | 'selection.noAutomation'
  | 'flow.summary'
  | 'excludedReports.line'
  | 'excludedReports.none'
  | 'registration.registered'
  | 'registration.none'
  | 'protocol.url'
  | 'protocol.none';
export type SuggestionLabels = (
  key: SuggestionKey,
  vars?: Record<string, string | number>,
) => string;

/**
 * Suggestions for checklist items that the project data can answer (PRD
 * Modul 6). They are offered, never written automatically.
 */
export function checklistSuggestions(
  data: FlowInput,
  t: SuggestionLabels,
): Partial<Record<string, Suggestion>> {
  const { project } = data;
  const flow = computeFlow(data);
  const db = flow.databases;
  const records = new Map(data.records.map((record) => [record.id, record]));
  const reasons = new Map(project.exclusionReasons.map((r) => [r.id, r.label]));
  const lines = (...parts: string[]) => parts.join('\n');

  // 5 Eligibility criteria
  const { inclusion, exclusion } = project.eligibility;
  const criteria = [
    ...(inclusion.length > 0 ? [t('eligibility.inclusion', { list: inclusion.join('; ') })] : []),
    ...(exclusion.length > 0 ? [t('eligibility.exclusion', { list: exclusion.join('; ') })] : []),
  ];

  // 6 Information sources with the date last searched
  const sources = data.sources
    .map((source) => {
      const runs = data.sourceRuns.filter((run) => run.sourceId === source.id);
      const date = latestRunDate(runs);
      const label = source.platform
        ? `${sourceLabel(source)} (${source.platform})`
        : sourceLabel(source);
      return date ? { label, date } : undefined;
    })
    .filter((s): s is { label: string; date: string } => s !== undefined)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  // 8 Selection process: single reviewer, stated openly (PRD §2)
  // Only the database column has a box for automation tools (PRISMA 2020 template).
  const automation = db.removedAutomation.n;

  // 16b Reports excluded at full text, with reason
  const excluded = [...db.reportsExcluded, ...flow.other.reportsExcluded].flatMap((reason) =>
    reason.recordIds.map((id) => {
      const csl = records.get(id)?.csl ?? {};
      return t('excludedReports.line', {
        author: formatAuthors({ author: csl.author?.slice(0, 1) }),
        year: yearOf(csl) ?? '',
        title: csl.title ?? '',
        reason: reasons.get(reason.reasonId) ?? reason.label,
      });
    }),
  );

  const { registry, id, url, protocolUrl } = project.registration;
  return {
    '5': { note: criteria.length > 0 ? lines(...criteria) : t('eligibility.none') },
    '6': {
      note:
        sources.length > 0
          ? lines(...sources.map((s) => t('sources.line', { source: s.label, date: s.date })))
          : t('sources.none'),
    },
    '7': { note: t('appendix.note'), location: t('appendix.location') },
    '8': {
      note: lines(
        t('selection.single', { name: project.reviewers[0]?.name ?? '' }),
        automation > 0
          ? t('selection.automation', { count: automation })
          : t('selection.noAutomation'),
      ),
    },
    '16a': {
      note: t('flow.summary', {
        identified: db.identified.n + flow.other.identified.n,
        duplicates: db.duplicates.n,
        removed: db.removedAutomation.n + db.removedOther.n,
        screened: db.screened.n,
        excluded: db.excluded.n,
        sought: db.sought.n + flow.other.sought.n,
        notRetrieved: db.notRetrieved.n + flow.other.notRetrieved.n,
        assessed: db.assessed.n + flow.other.assessed.n,
        reportsExcluded: db.reportsExcludedTotal.n + flow.other.reportsExcludedTotal.n,
        studies: flow.studies.n,
        reports: flow.reports.n,
      }),
    },
    '16b': { note: excluded.length > 0 ? lines(...excluded) : t('excludedReports.none') },
    '24a': {
      note:
        registry || id
          ? t('registration.registered', { registry, id, url })
          : t('registration.none'),
    },
    '24b': { note: protocolUrl ? t('protocol.url', { url: protocolUrl }) : t('protocol.none') },
  };
}
