import { describe, expect, it } from 'vitest';
import type { BibRecord, CslItem, DedupDecision } from '../types';
import { deduplicate, TITLE_SIMILARITY_THRESHOLD, type DedupRecord } from './dedup';

let counter = 0;
function rec(id: string, csl: CslItem, ids: Pick<BibRecord, 'doi' | 'pmid'> = {}): DedupRecord {
  return { id, csl, ...ids };
}
const article = (title: string, family: string, year?: number, extra: CslItem = {}): CslItem => ({
  title,
  author: [{ family }],
  ...(year ? { issued: { 'date-parts': [[year]] } } : {}),
  ...extra,
});
function decision(value: DedupDecision['value'], ...recordIds: string[]): DedupDecision {
  counter += 1;
  return {
    id: `d-${counter}`,
    projectId: 'p',
    recordIds,
    value,
    reviewerId: 'rev',
    timestamp: `2026-10-01T10:00:${String(counter).padStart(2, '0')}.000Z`,
  };
}

describe('deduplicate – automatic rules', () => {
  it('merges equal DOIs and equal PMIDs, DOI being the stronger rule', () => {
    const records = [
      rec('a1', article('One', 'Berger', 2022), { doi: '10.1/x' }),
      rec('a2', article('One.', 'Berger', 2022), { doi: '10.1/x' }),
      rec('k1', article('Two', 'Weber', 2024), { pmid: '9' }),
      rec('k2', article('Two', 'Weber', 2024), { pmid: '9' }),
      rec('z', article('Unrelated', 'Roe', 2020)),
    ];
    const { groups, stats } = deduplicate(records, []);
    expect(groups.map((g) => [g.rule, [...g.memberIds].sort()])).toEqual([
      ['doi', ['a1', 'a2']],
      ['pmid', ['k1', 'k2']],
    ]);
    expect(groups[0]?.links).toEqual([{ a: 'a1', b: 'a2', rule: 'doi' }]);
    expect(stats).toMatchObject({ records: 5, duplicatesRemoved: 2, unique: 3, openCandidates: 0 });
  });

  it('joins chains: A–B by DOI and B–C by PMID form one group', () => {
    const records = [
      rec('a', article('T', 'X'), { doi: '10.1/x' }),
      rec('b', article('T', 'X'), { doi: '10.1/x', pmid: '5' }),
      rec('c', article('T', 'X'), { pmid: '5' }),
    ];
    const [group] = deduplicate(records, []).groups;
    expect([...(group?.memberIds ?? [])].sort()).toEqual(['a', 'b', 'c']);
    expect(group?.rule).toBe('doi');
  });
});

describe('deduplicate – fuzzy candidates', () => {
  const d1 = rec(
    'd1',
    article(
      'Peer review of search strategies: a randomised comparison of two checklists',
      'Okafor',
      2023,
    ),
    { doi: '10.5555/4' },
  );
  const d2 = rec(
    'd2',
    article(
      'Peer review of search strategies: a randomized comparison of two checklists',
      'Okafor',
      2024,
    ),
    { doi: '10.5555/5' },
  );

  it('proposes similar titles with same first author and year ±1, never merging them', () => {
    const { groups, candidates } = deduplicate([d1, d2], []);
    expect(groups).toEqual([]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      a: 'd1',
      b: 'd2',
      reasons: { sameFirstAuthor: true, years: [2023, 2024], doiConflict: true },
    });
    expect(candidates[0]?.score).toBeGreaterThan(0.98);
  });

  it('uses 0.90 as threshold', () => {
    expect(TITLE_SIMILARITY_THRESHOLD).toBe(0.9);
  });

  it('rejects candidates with a year gap above 1 or a different first author', () => {
    const later = { ...d2, csl: { ...d2.csl, issued: { 'date-parts': [[2026]] } } };
    expect(deduplicate([d1, later], []).candidates).toEqual([]);
    const other = { ...d2, csl: { ...d2.csl, author: [{ family: 'Lindqvist' }] } };
    expect(deduplicate([d1, other], []).candidates).toEqual([]);
  });

  it('treats a missing year or author as unknown, not as a contradiction', () => {
    const noYear = { ...d2, csl: { title: d2.csl.title, author: d2.csl.author } };
    const noAuthor = { ...d2, csl: { title: d2.csl.title, issued: d2.csl.issued } };
    expect(deduplicate([d1, noYear], []).candidates[0]?.reasons.years).toEqual([2023, undefined]);
    expect(deduplicate([d1, noAuthor], []).candidates[0]?.reasons.sameFirstAuthor).toBeUndefined();
  });

  it('never pairs an erratum with the original (case E)', () => {
    const erratum = rec(
      'e1',
      article(
        'Correction to: Peer review of search strategies: a randomized comparison of two checklists',
        'Okafor',
        2024,
      ),
      { doi: '10.5555/6' },
    );
    expect(deduplicate([d2, erratum], []).candidates).toEqual([]);
  });

  it('does not propose identical generic titles by different authors (case F)', () => {
    const f1 = rec('f1', article('Editorial', 'Svensson', 2024), { doi: '10.5555/7' });
    const f2 = rec('f2', article('Editorial', 'Tanaka', 2024), { doi: '10.5555/8' });
    expect(deduplicate([f1, f2], []).candidates).toEqual([]);
  });

  it('compares a merged group only once, via its primary record', () => {
    const d2copy = rec('d2b', d2.csl, { doi: '10.5555/5' });
    const { candidates } = deduplicate([d1, d2, d2copy], []);
    expect(candidates).toHaveLength(1);
  });
});

describe('deduplicate – decisions', () => {
  const c1 = rec(
    'c1',
    article(
      'Informationskompetenz und systematische Übersichtsarbeiten an Fachhochschulen',
      'Müller',
      2023,
    ),
  );
  const c2 = rec(
    'c2',
    article(
      'INFORMATIONSKOMPETENZ UND SYSTEMATISCHE UEBERSICHTSARBEITEN AN FACHHOCHSCHULEN',
      'Mueller',
      2023,
    ),
  );
  const a1 = rec('a1', article('One', 'Berger', 2022, { abstract: 'x' }), { doi: '10.1/x' });
  const a2 = rec('a2', article('One', 'Berger', 2022), { doi: '10.1/x' });

  it('confirming a candidate merges it with rule title-fuzzy and its score', () => {
    const merge = decision('merge', 'c1', 'c2');
    const { groups, candidates } = deduplicate([c1, c2], [merge]);
    expect(candidates).toEqual([]);
    expect(groups[0]).toMatchObject({
      rule: 'title-fuzzy',
      score: 1,
      confirmedAt: merge.timestamp,
      links: [{ a: 'c1', b: 'c2', rule: 'title-fuzzy', score: 1 }],
    });
  });

  it('a merge of records that are not a candidate is manual', () => {
    const x = rec('x', article('Totally different', 'Roe', 2020));
    const { groups } = deduplicate([c1, x], [decision('merge', 'c1', 'x')]);
    expect(groups[0]).toMatchObject({
      rule: 'manual',
      links: [{ a: 'c1', b: 'x', rule: 'manual' }],
    });
  });

  it('rejecting a candidate keeps the records apart and hides the candidate', () => {
    const { groups, candidates, stats } = deduplicate([c1, c2], [decision('separate', 'c2', 'c1')]);
    expect(groups).toEqual([]);
    expect(candidates).toEqual([]);
    expect(stats.separatedPairs).toBe(1);
  });

  it('can undo an automatic DOI merge and restore it with reset', () => {
    expect(deduplicate([a1, a2], [decision('separate', 'a1', 'a2')]).groups).toEqual([]);
    const restored = deduplicate(
      [a1, a2],
      [decision('separate', 'a1', 'a2'), decision('reset', 'a1', 'a2')],
    );
    expect(restored.groups).toHaveLength(1);
  });

  it('the latest decision per pair wins, regardless of id order', () => {
    const decisions = [decision('merge', 'c1', 'c2'), decision('separate', 'c2', 'c1')];
    expect(deduplicate([c1, c2], decisions).groups).toEqual([]);
    expect(deduplicate([c1, c2], [...decisions].reverse()).groups).toEqual([]);
  });

  it('picks the most complete record as primary unless the user chose one', () => {
    expect(deduplicate([a2, a1], []).groups[0]?.primaryRecordId).toBe('a1'); // has an abstract
    const chosen = deduplicate([a1, a2], [decision('primary', 'a2')]);
    expect(chosen.groups[0]?.primaryRecordId).toBe('a2');
    expect(chosen.groups[0]?.memberIds[0]).toBe('a2');
  });

  it('ignores decisions about records that no longer exist', () => {
    expect(deduplicate([c1, c2], [decision('merge', 'c1', 'gone')]).groups).toEqual([]);
  });
});

describe('deduplicate – scale', () => {
  it('handles thousands of records by blocking instead of comparing all pairs', () => {
    const records: DedupRecord[] = Array.from({ length: 5000 }, (_, i) =>
      rec(
        `r${i}`,
        article(
          `Study number ${i} on topic ${i % 97} with words ${i * 7}`,
          `Author${i % 500}`,
          2000 + (i % 25),
        ),
      ),
    );
    const started = performance.now();
    const { stats } = deduplicate(records, []);
    expect(stats.records).toBe(5000);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
