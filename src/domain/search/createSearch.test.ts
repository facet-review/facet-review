import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import type { SourceRun } from '../types';
import { createRun, createSource, pruneRun, runFromDraft, draftFromRun } from './createSearch';

describe('createSource / createRun', () => {
  it('creates a source with an id and trimmed name', () => {
    expect(
      createSource({ projectId: 'p', type: 'database', name: ' MEDLINE ' }, sequentialIds('s')),
    ).toEqual({ id: 's-1', projectId: 'p', type: 'database', name: 'MEDLINE' });
  });

  it('creates an empty run for a source on the given day', () => {
    expect(
      createRun({ projectId: 'p', sourceId: 's-1', date: '2026-09-30' }, sequentialIds('r')),
    ).toEqual({ id: 'r-1', projectId: 'p', sourceId: 's-1', date: '2026-09-30', searchString: '' });
  });
});

const fullRun: SourceRun = {
  id: 'r',
  projectId: 'p',
  sourceId: 's',
  date: '2026-09-01',
  dateTo: '2026-09-10',
  searchString: 'a OR b',
  limits: '2010-',
  reportedHits: 10,
  tool: 'Publish or Perish',
  method: 'browse',
  recordsChecked: 200,
  citationDirection: 'both',
  seedDocuments: 'Doe 2020',
  description: 'Mail to society',
  notes: 'note',
};

describe('pruneRun', () => {
  it('keeps only fields that apply to the source type', () => {
    expect(pruneRun('database', fullRun)).toEqual({
      id: 'r',
      projectId: 'p',
      sourceId: 's',
      date: '2026-09-01',
      searchString: 'a OR b',
      limits: '2010-',
      reportedHits: 10,
      notes: 'note',
    });
    expect(pruneRun('contact', fullRun)).toEqual({
      id: 'r',
      projectId: 'p',
      sourceId: 's',
      date: '2026-09-01',
      dateTo: '2026-09-10',
      searchString: '',
      reportedHits: 10,
      description: 'Mail to society',
      notes: 'note',
    });
  });

  it('drops empty optional text but keeps the search string verbatim', () => {
    const run = {
      ...fullRun,
      limits: '   ',
      notes: '',
      searchString: '  1 exp Tutoring/\n  2 1 and 3  ',
    };
    const pruned = pruneRun('database', run);
    expect(pruned).not.toHaveProperty('limits');
    expect(pruned).not.toHaveProperty('notes');
    expect(pruned.searchString).toBe('  1 exp Tutoring/\n  2 1 and 3  ');
  });
});

describe('form drafts', () => {
  it('round-trips a run through its string-based form draft', () => {
    expect(runFromDraft(draftFromRun(fullRun))).toEqual(fullRun);
  });

  it('converts counts: empty means absent, text stays invalid for validation', () => {
    const draft = { ...draftFromRun(fullRun), reportedHits: '', recordsChecked: 'viele' };
    const run = runFromDraft(draft);
    expect(run).not.toHaveProperty('reportedHits');
    expect(run.recordsChecked).toBeNaN();
  });

  it('treats an empty end date as absent', () => {
    expect(runFromDraft({ ...draftFromRun(fullRun), dateTo: '' })).not.toHaveProperty('dateTo');
  });
});
