import type { DateOnly, SourceRun, UUID } from '../types';
import { buildWorksUrl, limitFilters, PAGE_SIZE, searchExpression } from './query';
import type { OpenAlexQuery } from './types';

export const OPENALEX_SOURCE = { name: 'OpenAlex', platform: 'OpenAlex API' } as const;

export type ProtocolLabelKey =
  'fromYear' | 'toYear' | 'years' | 'types' | 'languages' | 'openAccess' | 'cursorNote';

/** Texts come from i18n (`openalex.protocol.*`), in the interface language at search time. */
export type ProtocolLabel = (
  key: ProtocolLabelKey,
  vars?: Record<string, string | number>,
) => string;

/** Readable description of the limits, followed by the raw filter for reproduction. */
export function describeLimits(query: OpenAlexQuery, label: ProtocolLabel): string | undefined {
  const filters = limitFilters(query);
  if (filters.length === 0) return undefined;
  const parts: string[] = [];
  const { fromYear: from, toYear: to } = query;
  if (from !== undefined && to !== undefined) parts.push(label('years', { from, to }));
  else if (from !== undefined) parts.push(label('fromYear', { year: from }));
  else if (to !== undefined) parts.push(label('toYear', { year: to }));
  if (query.types.length > 0) parts.push(label('types', { list: query.types.join(', ') }));
  if (query.languages.length > 0) {
    parts.push(label('languages', { list: query.languages.join(', ') }));
  }
  if (query.openAccessOnly) parts.push(label('openAccess'));
  return `${parts.join('; ')}\nfilter=${filters.join(',')}`;
}

/**
 * The search run that documents an OpenAlex search automatically (PRISMA-S
 * items 1, 8, 9, 13): date, the search verbatim, limits, reported hits and
 * the full request URL – without e-mail address or key. The interface is the
 * source's platform ("OpenAlex API"); database runs have no `tool` field.
 */
export function runFromQuery(
  query: OpenAlexQuery,
  input: { id: UUID; projectId: UUID; sourceId: UUID; date: DateOnly; count: number },
  label: ProtocolLabel,
): SourceRun {
  const run: SourceRun = {
    id: input.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
    date: input.date,
    searchString: searchExpression(query),
    reportedHits: input.count,
    notes: `${buildWorksUrl(query, { perPage: PAGE_SIZE, cursor: '*' })}\n${label('cursorNote')}`,
  };
  const limits = describeLimits(query, label);
  if (limits) run.limits = limits;
  else run.noLimits = true;
  return run;
}
