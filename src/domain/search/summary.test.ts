import { describe, expect, it } from 'vitest';
import type { Source, SourceRun } from '../types';
import {
  groupSourcesByType,
  latestRunDate,
  reportedHitsByColumn,
  sortRuns,
  sourceLabel,
} from './summary';

const src = (id: string, type: Source['type'], name: string, databases?: string[]): Source => ({
  id,
  projectId: 'p',
  type,
  name,
  ...(databases ? { databases } : {}),
});

const run = (
  id: string,
  sourceId: string,
  date: string,
  extra: Partial<SourceRun> = {},
): SourceRun => ({
  id,
  projectId: 'p',
  sourceId,
  date,
  searchString: '',
  ...extra,
});

describe('sortRuns / latestRunDate', () => {
  const runs = [run('b', 's', '2026-09-20'), run('a', 's', '2026-03-01', { dateTo: '2026-09-25' })];

  it('sorts runs chronologically (first search, then updates)', () => {
    expect(sortRuns(runs).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('uses the end of a period as the last search date', () => {
    expect(latestRunDate(runs)).toBe('2026-09-25');
    expect(latestRunDate([])).toBeUndefined();
  });
});

describe('groupSourcesByType', () => {
  it('orders groups by reporting order and sources by name', () => {
    const groups = groupSourcesByType([
      src('1', 'website', 'Eurydice'),
      src('2', 'database', 'Scopus'),
      src('3', 'database', 'ERIC'),
    ]);
    expect(groups.map((g) => [g.type, g.sources.map((s) => s.name)])).toEqual([
      ['database', ['ERIC', 'Scopus']],
      ['website', ['Eurydice']],
    ]);
  });
});

describe('reportedHitsByColumn', () => {
  it('sums reported hits per flow column and counts runs without a number', () => {
    const sources = [
      src('db', 'database', 'Scopus'),
      src('gs', 'search_engine', 'Google Scholar'),
      src('web', 'website', 'Eurydice'),
    ];
    const runs = [
      run('1', 'db', '2026-09-01', { reportedHits: 100 }),
      run('2', 'gs', '2026-09-01', { reportedHits: 50 }),
      run('3', 'web', '2026-09-01', { reportedHits: 4 }),
      run('4', 'web', '2026-09-02'),
      run('5', 'unknown-source', '2026-09-02', { reportedHits: 999 }),
    ];
    expect(reportedHitsByColumn(sources, runs)).toEqual({
      databases_registers: { hits: 150, runsWithoutHits: 0 },
      other_methods: { hits: 4, runsWithoutHits: 1 },
    });
  });
});

describe('sourceLabel', () => {
  it('lists the databases of a multi-database search', () => {
    expect(sourceLabel(src('1', 'database', 'EBSCOhost', ['CINAHL', 'ERIC']))).toBe(
      'EBSCOhost (CINAHL, ERIC)',
    );
    expect(sourceLabel(src('1', 'database', 'Scopus', []))).toBe('Scopus');
    expect(sourceLabel(src('1', 'database', 'Scopus'))).toBe('Scopus');
  });
});
