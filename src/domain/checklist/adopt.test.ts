import { describe, expect, it } from 'vitest';
import { adoptSuggestion, checklistProgress } from './adopt';

const base = { projectId: 'p', itemId: '6' };

describe('adoptSuggestion', () => {
  it('fills empty fields and marks the item as done', () => {
    expect(adoptSuggestion(undefined, base, { note: 'Sources', location: 'Appendix' })).toEqual({
      entry: { ...base, status: 'done', note: 'Sources', location: 'Appendix' },
      overwrites: [],
    });
  });

  it('reports which filled fields would be replaced – never silently', () => {
    const entry = { ...base, status: 'open' as const, note: 'Own text', location: 'p. 4' };
    const result = adoptSuggestion(entry, base, { note: 'Sources', location: 'p. 4' });
    expect(result.overwrites).toEqual(['note']);
    expect(result.entry.note).toBe('Sources');
  });

  it('keeps fields the suggestion does not cover and an n/a status', () => {
    const entry = { ...base, status: 'na' as const, location: 'p. 4' };
    expect(adoptSuggestion(entry, base, { note: 'x' }).entry).toEqual({
      ...entry,
      note: 'x',
    });
  });
});

describe('checklistProgress', () => {
  it('counts done, not applicable and open (missing entries are open)', () => {
    const entries = [
      { ...base, itemId: '1', status: 'done' as const },
      { ...base, itemId: '2', status: 'na' as const },
      { ...base, itemId: '3', status: 'open' as const },
      { ...base, itemId: 'x', status: 'done' as const },
    ];
    expect(checklistProgress(entries, ['1', '2', '3', '4'])).toEqual({
      total: 4,
      done: 1,
      na: 1,
      open: 2,
    });
  });
});
