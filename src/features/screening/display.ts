import { formatAuthors } from '../../domain/dedup/compare';
import { yearOf } from '../../domain/import/normalize';
import type { BibRecord, CslItem } from '../../domain/types';

/** Display fields of a record (no logic beyond formatting). */
export function recordSummary(record: BibRecord | undefined) {
  const csl: CslItem = record?.csl ?? { type: 'article' };
  return {
    title: typeof csl.title === 'string' ? csl.title : '',
    authors: formatAuthors(csl),
    firstAuthor: csl.author?.[0]?.family ?? csl.author?.[0]?.literal ?? '',
    year: yearOf(csl),
    container: typeof csl['container-title'] === 'string' ? csl['container-title'] : '',
    abstract: typeof csl.abstract === 'string' ? csl.abstract : '',
    type: csl.type,
  };
}
