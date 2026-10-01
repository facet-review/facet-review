import { describe, expect, it } from 'vitest';
import { deduplicate, type DedupRecord } from '../../src/domain/dedup/dedup';
import type { ParsedRecord } from '../../src/domain/import/types';
import type { DedupDecision } from '../../src/domain/types';
import { labelOf, parseFixture } from './fixtures';

function withIds(
  records: ParsedRecord[],
  idOf: (r: ParsedRecord, i: number) => string,
): DedupRecord[] {
  return records.map((r, i) => ({ id: idOf(r, i), csl: r.csl, doi: r.doi, pmid: r.pmid }));
}

function decision(
  value: DedupDecision['value'],
  a: string,
  b: string,
  second: number,
): DedupDecision {
  return {
    id: `dd-${second}`,
    projectId: 'p',
    recordIds: [a, b],
    value,
    reviewerId: 'rev',
    timestamp: `2026-10-01T12:00:${String(second).padStart(2, '0')}.000Z`,
  };
}

/** tests/fixtures/README.md, "Erwartete Ergebnisse synthetic/" – one test per stated expectation. */
describe('synthetic fixtures: documented dedup expectations', () => {
  const records = withIds(
    [
      ...parseFixture('synthetic/edge-cases.ris', 'ris').records,
      ...parseFixture('synthetic/edge-cases.nbib', 'nbib').records,
      ...parseFixture('synthetic/edge-cases.csv', 'csv').records,
    ],
    (r) => labelOf(r.csl.abstract)!,
  );
  const result = deduplicate(records, []);
  const group = (...ids: string[]) =>
    result.groups.find((g) => [...g.memberIds].sort().join() === [...ids].sort().join());
  const candidate = (a: string, b: string) =>
    result.candidates.find((c) => [c.a, c.b].sort().join() === [a, b].sort().join());

  it('imports 16 records', () => {
    expect(records).toHaveLength(16);
  });

  it('A: A1 and A2 merged automatically by DOI', () => {
    expect(group('A1', 'A2')?.rule).toBe('doi');
  });

  it('B: B-ris and B-nbib merged across files by DOI', () => {
    expect(group('B-ris', 'B-nbib')?.rule).toBe('doi');
  });

  it('K: K1 and K2 merged by PMID', () => {
    expect(group('K1', 'K2')?.rule).toBe('pmid');
  });

  it('C: C1/C2 proposed as fuzzy candidate, not merged', () => {
    expect(candidate('C1', 'C2')).toBeDefined();
    expect(group('C1', 'C2')).toBeUndefined();
  });

  it('D: D1/D2 proposed as candidate, not merged automatically (different DOIs)', () => {
    expect(candidate('D1', 'D2')?.reasons.doiConflict).toBe(true);
    expect(group('D1', 'D2')).toBeUndefined();
  });

  it('E: the erratum E1 is neither merged with nor proposed for D2 (or D1)', () => {
    expect(candidate('E1', 'D2')).toBeUndefined();
    expect(candidate('E1', 'D1')).toBeUndefined();
    expect(result.groups.some((g) => g.memberIds.includes('E1'))).toBe(false);
  });

  it('F: the two editorials are neither merged nor proposed', () => {
    expect(candidate('F1', 'F2')).toBeUndefined();
    expect(group('F1', 'F2')).toBeUndefined();
  });

  it('counts: 3 merged automatically (A, B, K), 2 candidate pairs open (C, D)', () => {
    expect(result.groups).toHaveLength(3);
    expect(result.stats).toMatchObject({
      records: 16,
      duplicatesRemoved: 3,
      unique: 13,
      openCandidates: 2,
    });
  });

  it('after confirming C and rejecting D: 12 unique records', () => {
    const decided = deduplicate(records, [
      decision('merge', 'C1', 'C2', 1),
      decision('separate', 'D1', 'D2', 2),
    ]);
    expect(decided.stats).toMatchObject({ unique: 12, openCandidates: 0, separatedPairs: 1 });
    expect(decided.groups.find((g) => g.memberIds.includes('C1'))?.rule).toBe('title-fuzzy');
  });
});

describe('real exports: deduplication across Scopus, PubMed and ProQuest', () => {
  const files = [
    ['scopus', parseFixture('real/scopus_ris.ris', 'ris').records],
    ['pubmed', parseFixture('real/pubmed_medline.nbib', 'nbib').records],
    ['proquest', parseFixture('real/proquest_ris.ris', 'ris').records],
  ] as const;
  const records = files.flatMap(([name, recs]) => withIds([...recs], (_, i) => `${name}-${i}`));
  const result = deduplicate(records, []);

  // Fixed after the first run (README: "nach dem ersten Lauf manuell geprüft und dann
  // als Erwartung fixiert"). Consistent with MANIFEST.md: 276 distinct DOIs plus 3
  // records without DOI, one of which is linked to PubMed via its PMID.
  it('merges 141 duplicates into 139 groups and leaves 278 unique records', () => {
    expect(result.stats).toMatchObject({
      records: 419,
      groups: 139,
      duplicatesRemoved: 141,
      unique: 278,
    });
    expect(result.groups.filter((g) => g.rule === 'doi')).toHaveLength(138);
    expect(result.groups.filter((g) => g.rule === 'pmid')).toHaveLength(1);
    expect(result.groups.filter((g) => g.memberIds.length === 3)).toHaveLength(2);
  });

  it('proposes exactly the two co-publications with different DOIs as candidates', () => {
    const pairs = result.candidates.map((c) => {
      const [a, b] = [c.a, c.b].map((id) => records.find((r) => r.id === id)!);
      return { dois: [a!.doi, b!.doi].sort(), score: c.score };
    });
    expect(pairs).toEqual([
      // PRISMA-S itself, published in Systematic Reviews and in JMLA
      { dois: ['10.1186/s13643-020-01542-z', '10.5195/jmla.2021.962'], score: 1 },
      // Spanish and English edition of the same journal (Enfermería Intensiva)
      { dois: ['10.1016/j.enfi.2023.06.001', '10.1016/j.enfie.2023.06.001'], score: 1 },
    ]);
  });
});
