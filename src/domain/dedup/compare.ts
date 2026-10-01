import { normalizeTitle, yearOf } from '../import/normalize';
import type { BibRecord, CslItem } from '../types';

export interface WordPart {
  text: string;
  changed: boolean;
}

/** Splits a title into words and separators; words missing from the other title are marked. */
export function diffWords(title: string, other: string): WordPart[] {
  const otherWords = new Set(normalizeTitle(other).split(' '));
  return title
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) => {
      if (/^\s+$/.test(part)) return { text: part, changed: false };
      const key = normalizeTitle(part);
      return { text: part, changed: key !== '' && !key.split(' ').every((w) => otherWords.has(w)) };
    });
}

const MAX_AUTHORS = 5;

export function formatAuthors(csl: Pick<CslItem, 'author'>): string {
  const names = (csl.author ?? []).map(
    (name) => name.literal ?? [name.family, name.given].filter(Boolean).join(', '),
  );
  return names.length > MAX_AUTHORS
    ? `${names.slice(0, MAX_AUTHORS).join('; ')}; …`
    : names.join('; ');
}

export type ComparedField = 'title' | 'authors' | 'year' | 'container' | 'type' | 'doi' | 'pmid';

export interface ComparisonRow {
  field: ComparedField;
  a: string;
  b: string;
  differs: boolean;
}

type Comparable = Pick<BibRecord, 'csl' | 'doi' | 'pmid'>;

/** Side-by-side values for the duplicate review; differences are judged on normalised values. */
export function compareRecords(a: Comparable, b: Comparable): ComparisonRow[] {
  const values: [ComparedField, (r: Comparable) => string, (v: string) => string][] = [
    ['title', (r) => r.csl.title ?? '', normalizeTitle],
    ['authors', (r) => formatAuthors(r.csl), normalizeTitle],
    ['year', (r) => String(yearOf(r.csl) ?? ''), (v) => v],
    ['container', (r) => r.csl['container-title'] ?? '', normalizeTitle],
    ['type', (r) => r.csl.type ?? '', (v) => v],
    ['doi', (r) => r.doi ?? '', (v) => v],
    ['pmid', (r) => r.pmid ?? '', (v) => v],
  ];
  return values.map(([field, read, normalize]) => {
    const valueA = read(a);
    const valueB = read(b);
    return { field, a: valueA, b: valueB, differs: normalize(valueA) !== normalize(valueB) };
  });
}
