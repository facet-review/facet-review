import { describe, expect, it } from 'vitest';
import type { OpenAlexWork } from './types';
import { abstractFromIndex, authorName, workToParsed, worksToParseResult } from './works';

describe('abstractFromIndex', () => {
  it('rebuilds the text in position order, with repeated words', () => {
    expect(abstractFromIndex({ b: [1], a: [0, 2], 'c.': [3] })).toBe('a b a c.');
  });

  it('is undefined without an index or for an empty one', () => {
    expect(abstractFromIndex(null)).toBeUndefined();
    expect(abstractFromIndex(undefined)).toBeUndefined();
    expect(abstractFromIndex({})).toBeUndefined();
  });

  it('skips gaps in the positions', () => {
    expect(abstractFromIndex({ a: [0], b: [2] })).toBe('a b');
  });
});

describe('authorName', () => {
  it('splits "Given Family" display names', () => {
    expect(authorName('Anna M. Berger')).toEqual({ family: 'Berger', given: 'Anna M.' });
  });

  it('keeps lower-case particles with the family name', () => {
    expect(authorName('José van der Linden')).toEqual({ family: 'van der Linden', given: 'José' });
    expect(authorName('van Gogh')).toEqual({ family: 'Gogh', given: 'van' });
  });

  it('keeps one-part names (often organisations) literal', () => {
    expect(authorName('Bibliotheksverbund')).toEqual({ literal: 'Bibliotheksverbund' });
  });

  it('parses "Family, Given" like the file parsers and ignores empty names', () => {
    expect(authorName('van der Linden, José')).toEqual({ family: 'van der Linden', given: 'José' });
    expect(authorName('  ')).toBeUndefined();
  });
});

describe('workToParsed', () => {
  const work: OpenAlexWork = {
    id: 'https://openalex.org/W1',
    doi: 'https://doi.org/10.5555/AB.1',
    display_name: 'A &amp; B',
    publication_year: 2024,
    publication_date: '2024-03-15',
    type: 'review',
    language: 'en',
    ids: { pmid: 'https://pubmed.ncbi.nlm.nih.gov/99000001' },
    authorships: [
      { author: { display_name: 'Ada Lovelace' } },
      { author: null, raw_author_name: 'Hopper, Grace' },
      { author: { display_name: '' } },
      { author: { display_name: 'Ignored Profile' }, raw_author_name: 'Printed, Name' },
    ],
    primary_location: {
      landing_page_url: 'https://example.org/a',
      source: { display_name: 'Journal X' },
    },
    biblio: { volume: '3', issue: '2', first_page: '10', last_page: '20' },
    abstract_inverted_index: { Hello: [0], 'world.': [1] },
  };

  it('maps all bibliographic fields to CSL and keeps the work as raw', () => {
    const parsed = workToParsed(work, 7);
    expect(parsed.line).toBe(7);
    expect(parsed.doi).toBe('10.5555/ab.1');
    expect(parsed.pmid).toBe('99000001');
    expect(parsed.csl).toEqual({
      type: 'article-journal',
      title: 'A & B',
      author: [
        { family: 'Lovelace', given: 'Ada' },
        { family: 'Hopper', given: 'Grace' },
        { family: 'Printed', given: 'Name' },
      ],
      issued: { 'date-parts': [[2024, 3, 15]] },
      'container-title': 'Journal X',
      volume: '3',
      issue: '2',
      page: '10-20',
      DOI: '10.5555/AB.1',
      PMID: '99000001',
      URL: 'https://example.org/a',
      abstract: 'Hello world.',
      language: 'en',
      openalex: 'https://openalex.org/W1',
    });
    expect(JSON.parse(parsed.raw)).toEqual(work);
  });

  it('falls back to the year, the title field, ids.doi and the generic type', () => {
    const parsed = workToParsed(
      {
        id: 'W2',
        title: 'Only title',
        publication_year: 2019,
        type: 'paratext',
        ids: { doi: 'https://doi.org/10.5555/x' },
      },
      1,
    );
    expect(parsed.csl).toMatchObject({
      type: 'document',
      title: 'Only title',
      issued: { 'date-parts': [[2019]] },
      DOI: '10.5555/x',
    });
    expect(parsed.doi).toBe('10.5555/x');
  });

  it('leaves out everything that is missing', () => {
    const parsed = workToParsed({ id: 'W3', doi: null, type: null, biblio: null }, 2);
    expect(parsed.csl).toEqual({ type: 'document', openalex: 'W3' });
    expect(parsed.doi).toBeUndefined();
    expect(parsed.pmid).toBeUndefined();
  });
});

describe('worksToParseResult', () => {
  it('numbers the records and flags works without title', () => {
    const result = worksToParseResult([{ id: 'W1', display_name: 'One' }, { id: 'W2' }]);
    expect(result.records.map((record) => record.line)).toEqual([1, 2]);
    expect(result.warnings).toEqual([{ code: 'missingTitle', line: 2 }]);
  });

  it('warns when there is nothing to import', () => {
    expect(worksToParseResult([])).toEqual({ records: [], warnings: [{ code: 'noRecords' }] });
  });
});
