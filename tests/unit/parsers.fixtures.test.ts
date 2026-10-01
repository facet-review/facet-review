import { describe, expect, it } from 'vitest';
import { labelOf, parseFixture } from './fixtures';

/**
 * Expectations from tests/fixtures/README.md (synthetic) and
 * tests/fixtures/real/MANIFEST.md (real exports).
 */
describe('synthetic fixtures', () => {
  const ris = parseFixture('synthetic/edge-cases.ris', 'ris');
  const nbib = parseFixture('synthetic/edge-cases.nbib', 'nbib');
  const csv = parseFixture('synthetic/edge-cases.csv', 'csv');
  const all = [...ris.records, ...nbib.records, ...csv.records];
  const record = (label: string) => all.find((r) => labelOf(r.csl.abstract) === label)!;

  it('contains 16 records in 3 files, all parsed without warnings', () => {
    expect([ris.records.length, nbib.records.length, csv.records.length]).toEqual([12, 2, 2]);
    expect([...ris.warnings, ...nbib.warnings, ...csv.warnings]).toEqual([]);
    expect(all.map((r) => labelOf(r.csl.abstract)).sort()).toEqual(
      [
        'A1',
        'A2',
        'B-nbib',
        'B-ris',
        'C1',
        'C2',
        'D1',
        'D2',
        'E1',
        'F1',
        'F2',
        'G1',
        'H1',
        'K1',
        'K2',
        'L1',
      ].sort(),
    );
  });

  it('A: the same DOI despite case and resolver prefix', () => {
    expect(record('A1').doi).toBe('10.5555/fr.test.0001');
    expect(record('A2').doi).toBe('10.5555/fr.test.0001');
  });

  it('B: the same DOI across RIS and .nbib', () => {
    expect(record('B-ris').doi).toBe(record('B-nbib').doi);
    expect(record('B-nbib').pmid).toBe('99000001');
  });

  it('K: the same PMID in .nbib and CSV, no DOI', () => {
    expect(record('K1').pmid).toBe('99000002');
    expect(record('K2').pmid).toBe('99000002');
    expect(record('K1').doi).toBeUndefined();
    expect(record('K2').doi).toBeUndefined();
  });

  it('C1: an empty DO line is not stored as DOI', () => {
    expect(record('C1').doi).toBeUndefined();
    expect(record('C1').csl).not.toHaveProperty('DOI');
  });

  it('G: book chapter without year, HTML entity, dash, apostrophe and accents', () => {
    const g = record('G1');
    expect(g.csl.type).toBe('chapter');
    expect(g.csl).not.toHaveProperty('issued');
    expect(g.csl.title).toBe('Grey literature searching & documentation – a practical guide');
    expect(g.csl.author).toEqual([{ family: "O'Brien", given: 'Siobhán' }]);
  });

  it('H: very long title, no authors, abstract from two AB lines joined', () => {
    const h = record('H1');
    expect(h.csl.title?.length).toBeGreaterThan(200);
    expect(h.csl).not.toHaveProperty('author');
    expect(h.csl.abstract).toBe(
      'Synthetic test record H1. Very long title, no authors. Second AB line: some exporters split abstracts across repeated tags. Expected: both lines joined.',
    );
  });

  it('L: CSV escaping of semicolons, commas and quotes', () => {
    expect(record('L1').csl.title).toBe('Semicolons; commas, and "quotes" in a CSV title');
  });

  it('BibTeX (added in milestone 3): macros, LaTeX, corporate author, broken entry', () => {
    const bib = parseFixture('synthetic/edge-cases.bib', 'bibtex');
    expect(bib.records.map((r) => r.csl.title)).toEqual([
      'Documenting PRISMA-S searches in Österreich: a cross-sectional study',
      'Grey literature at conferences',
      'A book after the broken entry',
    ]);
    expect(bib.records[0]).toMatchObject({ doi: '10.5555/fr.test.0020', pmid: '99000020' });
    expect(bib.records[0]?.csl['container-title']).toBe(
      'Journal of the Medical Library Association',
    );
    expect(bib.warnings.map((w) => [w.code, w.line])).toEqual([['bibtexError', 23]]);
  });
});

describe('real exports (robustness)', () => {
  const scopusRis = parseFixture('real/scopus_ris.ris', 'ris');
  const scopusCsv = parseFixture('real/scopus_csv.csv', 'csv');
  const pubmed = parseFixture('real/pubmed_medline.nbib', 'nbib');
  const proquest = parseFixture('real/proquest_ris.ris', 'ris');
  const dois = (records: { doi?: string }[]) =>
    new Set(records.map((r) => r.doi).filter((doi): doi is string => !!doi));

  it('imports every record listed in MANIFEST.md, each with a title', () => {
    expect(scopusRis.records).toHaveLength(209);
    expect(scopusCsv.records).toHaveLength(209);
    expect(pubmed.records).toHaveLength(190);
    expect(proquest.records).toHaveLength(20);
    for (const result of [scopusRis, scopusCsv, pubmed, proquest]) {
      expect(result.records.every((r) => (r.csl.title ?? '').length > 0)).toBe(true);
    }
  });

  it('reports only known quirks as warnings', () => {
    // Scopus exports four records with internal labels instead of RIS types.
    expect(scopusRis.warnings.map((w) => w.code)).toEqual(Array(4).fill('unknownType'));
    expect(scopusCsv.warnings).toEqual([]);
    expect(pubmed.warnings).toEqual([]);
    expect(proquest.warnings).toEqual([]);
  });

  it('finds identifiers as documented', () => {
    expect(dois(scopusRis.records).size).toBe(207); // 2 records without DOI
    expect(scopusRis.records.filter((r) => r.pmid)).toHaveLength(104); // C2 = PMID in Scopus RIS
    expect(dois(pubmed.records).size).toBe(189); // 1 record without DOI
    expect(pubmed.records.every((r) => r.pmid)).toBe(true);
    expect(dois(scopusCsv.records)).toEqual(dois(scopusRis.records));
    expect(scopusCsv.records.filter((r) => r.pmid)).toHaveLength(104);
  });

  it('reproduces the DOI overlaps from the manifest', () => {
    const scopus = dois(scopusRis.records);
    const med = dois(pubmed.records);
    const pq = dois(proquest.records);
    const both = (a: Set<string>, b: Set<string>) => [...a].filter((doi) => b.has(doi)).length;
    expect(both(scopus, med)).toBe(138);
    expect(both(scopus, pq)).toBe(2);
    expect(both(med, pq)).toBe(2);
    expect([...scopus].filter((doi) => med.has(doi) && pq.has(doi))).toHaveLength(2);
    expect(new Set([...scopus, ...med, ...pq]).size).toBe(276);
  });

  it('keeps vendor specifics: ProQuest author suffix and date, Scopus full names', () => {
    const raszewski = proquest.records.find((r) => r.csl.author?.[0]?.family === 'Raszewski');
    expect(raszewski?.csl.author?.[0]).toEqual({
      family: 'Raszewski',
      given: 'Rebecca',
      suffix: 'AHIP',
    });
    expect(raszewski?.csl.issued).toEqual({ 'date-parts': [[2026, 4]] });
    expect(scopusCsv.records[0]?.csl.author?.[0]).toEqual({
      family: 'Pasupuleti',
      given: 'Mohan Kumar',
    });
  });
});
