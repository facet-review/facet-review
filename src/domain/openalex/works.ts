import { compactCsl, cleanText, pages, parseIssued } from '../import/fields';
import { normalizeDoi, normalizePmid, parsePersonName } from '../import/normalize';
import type { ParsedRecord, ParseResult } from '../import/types';
import type { CslItem, CslName, ImportWarning } from '../types';
import type { OpenAlexAuthorship, OpenAlexWork } from './types';

/** OpenAlex work types → CSL types (same targets as the RIS parser). */
const TYPE_MAP: Record<string, string> = {
  article: 'article-journal',
  review: 'article-journal',
  letter: 'article-journal',
  editorial: 'article-journal',
  erratum: 'article-journal',
  preprint: 'article',
  'book-chapter': 'chapter',
  book: 'book',
  dissertation: 'thesis',
  report: 'report',
  dataset: 'dataset',
  'reference-entry': 'entry-encyclopedia',
  standard: 'standard',
  'peer-review': 'review',
};

/** Rebuilds an abstract from OpenAlex's inverted index (word → positions). */
export function abstractFromIndex(index: Record<string, number[]> | null | undefined) {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return cleanText(words.filter((word) => word !== undefined).join(' '));
}

/**
 * OpenAlex names are "Given Family" display names. Lower-case particles before
 * the last word belong to the family name ("José van der Linden"). A one-part
 * name (often an organisation) stays literal; "Family, Given" goes through the
 * import parser.
 */
export function authorName(display: string): CslName | undefined {
  const name = display.trim().replace(/\s+/g, ' ');
  if (!name) return undefined;
  if (name.includes(',')) return parsePersonName(name);
  const tokens = name.split(' ');
  if (tokens.length < 2) return { literal: name };
  let start = tokens.length - 1;
  while (start > 1 && /^\p{Ll}/u.test(tokens[start - 1]!)) start--;
  return { family: tokens.slice(start).join(' '), given: tokens.slice(0, start).join(' ') };
}

/** The author's name as printed (comma form) is more reliable than the profile name. */
function authorOf(authorship: OpenAlexAuthorship): CslName | undefined {
  const raw = authorship.raw_author_name ?? '';
  if (raw.includes(',')) return authorName(raw);
  return authorName(authorship.author?.display_name || raw);
}

const DOI_URL = /^https?:\/\/(?:dx\.)?doi\.org\//i;

/**
 * One OpenAlex work as a parsed record, like a line of an import file:
 * `raw` keeps the work as received (provenance), `line` is its position in
 * the result list (1-based).
 */
export function workToParsed(work: OpenAlexWork, position: number): ParsedRecord {
  const doiText = work.doi ?? work.ids?.doi ?? undefined;
  const doi = normalizeDoi(doiText ?? undefined);
  const pmid = normalizePmid(work.ids?.pmid ?? undefined);
  const authors = (work.authorships ?? [])
    .map(authorOf)
    .filter((name): name is CslName => name !== undefined);
  const biblio = work.biblio ?? {};
  const csl: CslItem = compactCsl({
    type: (work.type && TYPE_MAP[work.type]) || 'document',
    title: cleanText(work.display_name ?? work.title ?? undefined),
    author: authors,
    issued:
      parseIssued(work.publication_date ?? undefined) ??
      parseIssued(work.publication_year ? String(work.publication_year) : undefined),
    'container-title': cleanText(work.primary_location?.source?.display_name ?? undefined),
    volume: biblio.volume ?? undefined,
    issue: biblio.issue ?? undefined,
    page: pages(biblio.first_page ?? undefined, biblio.last_page ?? undefined),
    // DOI as published (without resolver); matching uses the normalised `doi`.
    DOI: doiText ? doiText.replace(DOI_URL, '') : undefined,
    PMID: pmid,
    URL: work.primary_location?.landing_page_url ?? undefined,
    abstract: abstractFromIndex(work.abstract_inverted_index),
    language: work.language ?? undefined,
    openalex: work.id,
  });
  const record: ParsedRecord = { csl, raw: JSON.stringify(work, null, 2), line: position };
  if (doi) record.doi = doi;
  if (pmid) record.pmid = pmid;
  return record;
}

/** All works as a parse result; works without a title are kept but flagged (as in file imports). */
export function worksToParseResult(works: readonly OpenAlexWork[]): ParseResult {
  const records = works.map((work, index) => workToParsed(work, index + 1));
  const warnings: ImportWarning[] = records
    .filter((record) => !record.csl.title)
    .map((record) => ({ code: 'missingTitle', line: record.line }));
  if (records.length === 0) warnings.push({ code: 'noRecords' });
  return { records, warnings };
}
