import { describe, expect, it } from 'vitest';
import { highlightSegments, parseTerms } from './highlight';

const marks = (text: string, include: string[], exclude: string[] = []) =>
  highlightSegments(text, { include, exclude })
    .filter((s) => s.mark)
    .map((s) => `${s.mark}:${s.text}`);

describe('highlightSegments', () => {
  it('returns the text unchanged without terms', () => {
    expect(highlightSegments('Peer tutoring', { include: [], exclude: [] })).toEqual([
      { text: 'Peer tutoring' },
    ]);
  });

  it('splits the text into marked and unmarked segments that rebuild it exactly', () => {
    const text = 'Peer tutoring improves grades.';
    const segments = highlightSegments(text, { include: ['tutoring'], exclude: ['grades'] });
    expect(segments).toEqual([
      { text: 'Peer ' },
      { text: 'tutoring', mark: 'include' },
      { text: ' improves ' },
      { text: 'grades', mark: 'exclude' },
      { text: '.' },
    ]);
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });

  it('ignores case and diacritics but keeps the original text', () => {
    expect(marks('Schülerinnen und SCHULE', ['schulerinnen', 'schule'])).toEqual([
      'include:Schülerinnen',
      'include:SCHULE',
    ]);
  });

  it('matches whole words only, unless truncated with *', () => {
    expect(marks('tutor tutoring tutors', ['tutor'])).toEqual(['include:tutor']);
    expect(marks('tutor tutoring tutors', ['tutor*'])).toEqual([
      'include:tutor',
      'include:tutoring',
      'include:tutors',
    ]);
  });

  it('matches phrases across any whitespace and strips quotes', () => {
    expect(marks('peer\n  tutoring', ['"peer tutoring"'])).toEqual(['include:peer\n  tutoring']);
  });

  it('prefers the longer match and never overlaps', () => {
    expect(marks('higher education', ['education'], ['higher education'])).toEqual([
      'exclude:higher education',
    ]);
  });

  it('treats regex characters in terms literally', () => {
    expect(marks('C++ (beginner)', ['c++', '(beginner)'])).toEqual([
      'include:C++',
      'include:(beginner)',
    ]);
  });

  it('keeps indices right when folding changes the length', () => {
    // "ﬁ" (one char) folds to "fi" (two chars) under NFKD.
    expect(marks('ﬁnal grades', ['grades'])).toEqual(['include:grades']);
  });
});

describe('parseTerms', () => {
  it('reads one term per line or comma, trimmed, without empties and duplicates', () => {
    expect(parseTerms('tutor*, peer tutoring\n\n  Grades ,tutor*')).toEqual([
      'tutor*',
      'peer tutoring',
      'Grades',
    ]);
  });
});
