import { describe, expect, it } from 'vitest';
import { deduplicate } from '../../src/domain/dedup/dedup';
import { toRis } from '../../src/domain/export/ris';
import { parseFile } from '../../src/domain/import/parseFile';
import type { ParsedRecord } from '../../src/domain/import/types';
import type { ImportFormat } from '../../src/domain/types';
import { parseFixture } from './fixtures';

const FILES: [string, ImportFormat][] = [
  ['synthetic/edge-cases.ris', 'ris'],
  ['synthetic/edge-cases.nbib', 'nbib'],
  ['synthetic/edge-cases.csv', 'csv'],
  ['synthetic/edge-cases.bib', 'bibtex'],
  ['real/scopus_ris.ris', 'ris'],
  ['real/pubmed_medline.nbib', 'nbib'],
  ['real/proquest_ris.ris', 'ris'],
];

/** The fields a reference manager needs; PMID travels as a note (no RIS tag exists). */
const core = (record: ParsedRecord) => {
  const { csl } = record;
  return {
    type: csl.type,
    title: csl.title,
    author: csl.author,
    editor: csl.editor,
    year: csl.issued?.['date-parts']?.[0]?.[0],
    container: csl['container-title'],
    volume: csl.volume,
    issue: csl.issue,
    page: csl.page,
    doi: record.doi,
  };
};

describe('RIS export roundtrip (export → own RIS parser)', () => {
  for (const [path, format] of FILES) {
    it(`keeps the core fields of ${path}`, () => {
      const original = parseFixture(path, format).records;
      const result = parseFile(
        toRis(original.map((r) => ({ csl: r.csl, doi: r.doi, pmid: r.pmid }))),
        'ris',
      );
      expect(result.warnings.filter((w) => w.code !== 'unknownType')).toEqual([]);
      expect(result.records).toHaveLength(original.length);
      expect(result.records.map(core)).toEqual(original.map(core));
    });
  }

  it('lets deduplication recognise re-imported records by DOI', () => {
    const original = parseFixture('synthetic/edge-cases.ris', 'ris').records;
    const reimported = parseFile(
      toRis(original.map((r) => ({ csl: r.csl, doi: r.doi }))),
      'ris',
    ).records;
    const withIds = (records: ParsedRecord[], prefix: string) =>
      records.map((r, i) => ({ id: `${prefix}${i}`, csl: r.csl, doi: r.doi, pmid: r.pmid }));
    const result = deduplicate([...withIds(original, 'o'), ...withIds(reimported, 'r')], []);
    const withDoi = original.filter((r) => r.doi);
    // Every original with a DOI is grouped with its re-imported copy.
    for (const [i, record] of original.entries()) {
      if (!record.doi) continue;
      expect(
        result.groups.some((g) => g.memberIds.includes(`o${i}`) && g.memberIds.includes(`r${i}`)),
      ).toBe(true);
    }
    expect(withDoi.length).toBeGreaterThan(5);
  });
});
