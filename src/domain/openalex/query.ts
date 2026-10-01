import {
  OPENALEX_API,
  type OpenAlexCredentials,
  type OpenAlexQuery,
  type SearchField,
} from './types';

/** Largest page OpenAlex serves (cursor paging). */
export const PAGE_SIZE = 200;

/** Upper bound per import: the performance target of PRD §6 (10 000 records per project). */
export const MAX_IMPORT = 10_000;

/** Only the fields the mapping needs – smaller responses, fewer credits. */
export const SELECT_FIELDS = [
  'id',
  'doi',
  'display_name',
  'publication_year',
  'publication_date',
  'type',
  'language',
  'ids',
  'authorships',
  'primary_location',
  'biblio',
  'abstract_inverted_index',
] as const;

/** Parameter form of the search field: two are filters, full text is the `search` parameter. */
const SEARCH_PARAMETER: Record<SearchField, string> = {
  title_and_abstract: 'title_and_abstract.search',
  title: 'title.search',
  fulltext: 'search',
};

export type QueryIssue =
  'textMissing' | 'textComma' | 'yearInvalid' | 'yearOrder' | 'languageInvalid';

const isYear = (value: number | undefined) =>
  value === undefined || (Number.isInteger(value) && value >= 1000 && value <= 2100);

/** Problems that would make OpenAlex reject or misread the query. */
export function validateQuery(query: OpenAlexQuery): QueryIssue[] {
  const issues: QueryIssue[] = [];
  if (query.text.trim() === '') issues.push('textMissing');
  // Filter values are comma-separated; a comma would silently split the search.
  else if (query.field !== 'fulltext' && query.text.includes(',')) issues.push('textComma');
  if (!isYear(query.fromYear) || !isYear(query.toYear)) issues.push('yearInvalid');
  else if (
    query.fromYear !== undefined &&
    query.toYear !== undefined &&
    query.fromYear > query.toYear
  ) {
    issues.push('yearOrder');
  }
  if (query.languages.some((code) => !/^[a-z]{2}$/.test(code))) issues.push('languageInvalid');
  return issues;
}

/** Language codes as typed ("en, DE de") → ["en", "de"], without duplicates. */
export function parseLanguages(input: string): string[] {
  const codes = input
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter(Boolean);
  return [...new Set(codes)];
}

/** The limiting filters (everything except the search itself), in OpenAlex syntax. */
export function limitFilters(query: OpenAlexQuery): string[] {
  const filters: string[] = [];
  if (query.fromYear !== undefined) filters.push(`from_publication_date:${query.fromYear}-01-01`);
  if (query.toYear !== undefined) filters.push(`to_publication_date:${query.toYear}-12-31`);
  if (query.types.length > 0) filters.push(`type:${query.types.join('|')}`);
  if (query.languages.length > 0) filters.push(`language:${query.languages.join('|')}`);
  if (query.openAccessOnly) filters.push('is_oa:true');
  return filters;
}

/** The search exactly as sent, e.g. `title_and_abstract.search:"peer tutoring"`. */
export function searchExpression(query: OpenAlexQuery): string {
  return `${SEARCH_PARAMETER[query.field]}:${query.text.trim()}`;
}

/**
 * URL of one request against /works. Credentials are added only when given;
 * leave them out for the URL that is written into the search protocol.
 */
export function buildWorksUrl(
  query: OpenAlexQuery,
  options: { perPage: number; cursor?: string; select?: readonly string[] } & OpenAlexCredentials,
): string {
  const params = new URLSearchParams();
  const text = query.text.trim();
  const filters = limitFilters(query);
  if (query.field === 'fulltext') params.set('search', text);
  else filters.unshift(`${SEARCH_PARAMETER[query.field]}:${text}`);
  if (filters.length > 0) params.set('filter', filters.join(','));
  params.set('select', (options.select ?? SELECT_FIELDS).join(','));
  params.set('per-page', String(options.perPage));
  if (options.cursor) params.set('cursor', options.cursor);
  const mailto = options.mailto?.trim();
  if (mailto) params.set('mailto', mailto);
  const apiKey = options.apiKey?.trim();
  if (apiKey) params.set('api_key', apiKey);
  return `${OPENALEX_API}/works?${params.toString()}`;
}
