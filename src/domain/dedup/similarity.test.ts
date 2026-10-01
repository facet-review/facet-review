import { describe, expect, it } from 'vitest';
import { boundedLevenshtein, isErratumTitle, titleSimilarity } from './similarity';

describe('boundedLevenshtein', () => {
  it('computes the edit distance', () => {
    expect(boundedLevenshtein('kitten', 'sitting', 10)).toBe(3);
    expect(boundedLevenshtein('', 'abc', 10)).toBe(3);
    expect(boundedLevenshtein('same', 'same', 0)).toBe(0);
  });

  it('stops early and returns max + 1 when the bound is exceeded', () => {
    expect(boundedLevenshtein('kitten', 'sitting', 2)).toBe(3);
    expect(boundedLevenshtein('abcdefgh', 'zzzzzzzz', 1)).toBe(2);
    expect(boundedLevenshtein('short', 'a much longer string', 3)).toBe(4);
  });
});

describe('titleSimilarity', () => {
  it('is 1 for identical and 0 for empty titles', () => {
    expect(titleSimilarity('peer review', 'peer review', 0.9)).toBe(1);
    expect(titleSimilarity('', '', 0.9)).toBe(0);
  });

  it('scores British vs American spelling just below 1 (case D)', () => {
    const a = 'peer review of search strategies a randomised comparison of two checklists';
    const b = 'peer review of search strategies a randomized comparison of two checklists';
    expect(titleSimilarity(a, b, 0.9)).toBeCloseTo(1 - 1 / a.length, 5);
  });

  it('returns 0 below the threshold instead of an exact value', () => {
    expect(titleSimilarity('editorial', 'a completely different title', 0.9)).toBe(0);
  });
});

describe('isErratumTitle', () => {
  it('recognises corrections, retractions and comments (case E)', () => {
    for (const title of [
      'correction to peer review of search strategies',
      'erratum effects of x',
      'corrigendum to y',
      'retraction note to z',
      'retracted article x',
      'expression of concern y',
      'author correction z',
      'publisher correction z',
      'reply to smith',
      'response to letter',
      'comment on x',
    ]) {
      expect(isErratumTitle(title), title).toBe(true);
    }
    expect(isErratumTitle('peer review of search strategies')).toBe(false);
    expect(isErratumTitle('correctional facilities and health')).toBe(false);
  });
});
