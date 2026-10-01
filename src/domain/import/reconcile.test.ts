import { describe, expect, it } from 'vitest';
import { importNoteRequired, reconcile } from './reconcile';

describe('reconcile', () => {
  it('compares imported and reported numbers of a search run', () => {
    expect(reconcile({ reportedHits: 10 }, 0)).toBe('notImported');
    expect(reconcile({ reportedHits: 10 }, 10)).toBe('match');
    expect(reconcile({ reportedHits: 10 }, 9)).toBe('mismatch');
    expect(reconcile({ reportedHits: 10, importNote: 'Export limit' }, 9)).toBe('justified');
    expect(reconcile({}, 5)).toBe('noReported');
  });
});

describe('importNoteRequired', () => {
  it('requires a justification only for differences that are not explained by further files', () => {
    expect(importNoteRequired(undefined, 12, false)).toBe(false);
    expect(importNoteRequired(12, 12, false)).toBe(false);
    expect(importNoteRequired(16, 12, false)).toBe(true);
    expect(importNoteRequired(16, 12, true)).toBe(false); // more files follow
    expect(importNoteRequired(10, 12, true)).toBe(true); // more than reported is never "pending"
  });
});
