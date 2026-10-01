import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import type { SourceRun } from '../types';
import {
  createRun,
  createSource,
  draftFromRun,
  pruneRun,
  pruneSource,
  runFromDraft,
} from './createSearch';

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

  it('keeps an explicit "no limits" and drops limit text that contradicts it', () => {
    const pruned = pruneRun('database', { ...fullRun, noLimits: true });
    expect(pruned.noLimits).toBe(true);
    expect(pruned).not.toHaveProperty('limits');
  });

  it('drops "no limits" where the source type has no limits field', () => {
    expect(pruneRun('contact', { ...fullRun, noLimits: true })).not.toHaveProperty('noLimits');
  });

  it('stores "no limits" only when set', () => {
    expect(pruneRun('database', { ...fullRun, noLimits: false })).not.toHaveProperty('noLimits');
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

  it('round-trips the "no limits" checkbox', () => {
    const run = { ...fullRun, limits: undefined, noLimits: true as const };
    const draft = draftFromRun(run);
    expect(draft.noLimits).toBe(true);
    expect(draftFromRun(fullRun).noLimits).toBe(false);
    expect(runFromDraft(draft).noLimits).toBe(true);
    expect(runFromDraft({ ...draft, noLimits: false })).not.toHaveProperty('noLimits');
  });

  it('treats an empty end date as absent', () => {
    expect(runFromDraft({ ...draftFromRun(fullRun), dateTo: '' })).not.toHaveProperty('dateTo');
  });
});

describe('pruneSource', () => {
  const full = {
    id: 's',
    projectId: 'p',
    type: 'database' as const,
    name: ' EBSCOhost ',
    platform: 'EBSCO',
    url: 'https://example.org',
    databases: ['CINAHL', ' ', 'ERIC '],
  };

  it('keeps the fields of the type, trims text and drops empty database entries', () => {
    expect(pruneSource(full)).toEqual({
      id: 's',
      projectId: 'p',
      type: 'database',
      name: 'EBSCOhost',
      platform: 'EBSCO',
      databases: ['CINAHL', 'ERIC'],
    });
  });

  it('removes fields that do not apply after a type change', () => {
    expect(pruneSource({ ...full, type: 'website' })).toEqual({
      id: 's',
      projectId: 'p',
      type: 'website',
      name: 'EBSCOhost',
      url: 'https://example.org',
    });
  });

  it('drops empty optional fields and an empty database list', () => {
    expect(pruneSource({ ...full, platform: '  ', databases: [' '] })).toEqual({
      id: 's',
      projectId: 'p',
      type: 'database',
      name: 'EBSCOhost',
    });
  });
});
