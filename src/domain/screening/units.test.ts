import { describe, expect, it } from 'vitest';
import type { ImportBatch, Source, SourceRun } from '../types';
import { orderRecords, runColumns, screeningUnits } from './units';

const record = (id: string, sourceRunId: string, importBatchId = 'b1', sourceLine?: number) => ({
  id,
  sourceRunId,
  importBatchId,
  ...(sourceLine !== undefined && { sourceLine }),
});

describe('runColumns', () => {
  it('maps every run to the flow-diagram column of its source type', () => {
    const sources = [
      { id: 's1', type: 'database' },
      { id: 's2', type: 'citation_search' },
      { id: 's3', type: 'search_engine' },
    ] as Source[];
    const runs = [
      { id: 'r1', sourceId: 's1' },
      { id: 'r2', sourceId: 's2' },
      { id: 'r3', sourceId: 's3' },
      { id: 'r4', sourceId: 'missing' },
    ] as SourceRun[];
    expect(Object.fromEntries(runColumns(sources, runs))).toEqual({
      r1: 'databases_registers',
      r2: 'other_methods',
      r3: 'databases_registers',
    });
  });
});

describe('orderRecords', () => {
  it('orders by import time, then by line in the file', () => {
    const batches = [
      { id: 'late', importedAt: '2026-10-02T00:00:00.000Z' },
      { id: 'early', importedAt: '2026-10-01T00:00:00.000Z' },
    ] as ImportBatch[];
    const records = [
      record('x', 'r', 'late', 1),
      record('y', 'r', 'early', 20),
      record('z', 'r', 'early', 3),
      record('w', 'r', 'early'),
    ];
    expect(orderRecords(records, batches).map((r) => r.id)).toEqual(['z', 'y', 'w', 'x']);
  });
});

describe('screeningUnits', () => {
  const columns = new Map([
    ['db', 'databases_registers' as const],
    ['cit', 'other_methods' as const],
  ]);

  it('forms one unit per duplicate group and one per remaining record, in record order', () => {
    const records = [record('a', 'db'), record('b', 'db'), record('c', 'cit'), record('d', 'db')];
    const groups = [{ id: 'g1', primaryRecordId: 'd', memberIds: ['d', 'b'] }];
    expect(screeningUnits(records, groups, columns)).toEqual([
      { key: 'a', primaryId: 'a', memberIds: ['a'], column: 'databases_registers' },
      { key: 'g1', primaryId: 'd', memberIds: ['d', 'b'], column: 'databases_registers' },
      { key: 'c', primaryId: 'c', memberIds: ['c'], column: 'other_methods' },
    ]);
  });

  it('puts a unit into the database column as soon as one member comes from there', () => {
    const records = [record('c', 'cit'), record('a', 'db')];
    const groups = [{ id: 'g', primaryRecordId: 'c', memberIds: ['c', 'a'] }];
    expect(screeningUnits(records, groups, columns)[0]?.column).toBe('databases_registers');
    const onlyOther = screeningUnits([record('c', 'cit'), record('e', 'cit')], [], columns);
    expect(onlyOther.map((u) => u.column)).toEqual(['other_methods', 'other_methods']);
  });

  it('ignores group members that no longer exist', () => {
    const groups = [{ id: 'g', primaryRecordId: 'a', memberIds: ['a', 'gone'] }];
    expect(screeningUnits([record('a', 'db')], groups, columns)[0]?.memberIds).toEqual(['a']);
  });
});
