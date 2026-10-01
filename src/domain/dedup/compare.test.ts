import { describe, expect, it } from 'vitest';
import { compareRecords, diffWords, formatAuthors } from './compare';

describe('diffWords', () => {
  it('marks words that do not occur in the other title (normalised)', () => {
    expect(diffWords('a randomised comparison', 'A randomized comparison.')).toEqual([
      { text: 'a', changed: false },
      { text: ' ', changed: false },
      { text: 'randomised', changed: true },
      { text: ' ', changed: false },
      { text: 'comparison', changed: false },
    ]);
  });

  it('treats umlauts and their transliteration as equal', () => {
    expect(diffWords('Übersicht', 'UEBERSICHT').every((part) => !part.changed)).toBe(true);
  });
});

describe('formatAuthors', () => {
  it('lists up to five authors and shortens longer lists', () => {
    expect(
      formatAuthors({ author: [{ family: 'Berger', given: 'Anna' }, { literal: 'WHO' }] }),
    ).toBe('Berger, Anna; WHO');
    const many = { author: Array.from({ length: 7 }, (_, i) => ({ family: `A${i}` })) };
    expect(formatAuthors(many)).toBe('A0; A1; A2; A3; A4; …');
    expect(formatAuthors({})).toBe('');
  });
});

describe('compareRecords', () => {
  it('lists the compared fields and flags differences after normalisation', () => {
    const rows = compareRecords(
      {
        csl: {
          title: 'Peer review: a randomised comparison',
          author: [{ family: 'Okafor', given: 'Chidi' }],
          issued: { 'date-parts': [[2023]] },
          'container-title': 'medRxiv',
          type: 'article-journal',
        },
        doi: '10.5555/4',
      },
      {
        csl: {
          title: 'Peer review: a randomized comparison',
          author: [{ family: 'Okafor', given: 'Chidi' }],
          issued: { 'date-parts': [[2024]] },
          'container-title': 'Research Synthesis Methods',
          type: 'article-journal',
        },
        doi: '10.5555/5',
      },
    );
    expect(rows.map((row) => [row.field, row.differs])).toEqual([
      ['title', true],
      ['authors', false],
      ['year', true],
      ['container', true],
      ['type', false],
      ['doi', true],
      ['pmid', false],
    ]);
    expect(rows.find((row) => row.field === 'year')).toMatchObject({ a: '2023', b: '2024' });
  });

  it('does not flag a field that is empty on both sides', () => {
    const rows = compareRecords({ csl: { title: 'X' } }, { csl: { title: 'x.' } });
    expect(rows.every((row) => !row.differs)).toBe(true);
  });
});
