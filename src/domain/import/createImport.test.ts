import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../testing';
import { createImport } from './createImport';

describe('createImport', () => {
  it('creates a batch and records that keep their provenance', () => {
    const { batch, records } = createImport(
      {
        records: [
          { csl: { title: 'A' }, raw: 'TY  - JOUR', line: 1, doi: '10.1/a' },
          { csl: { title: 'B' }, raw: 'TY  - JOUR', line: 9, pmid: '5' },
        ],
        warnings: [{ code: 'missingEnd', line: 9 }],
      },
      { projectId: 'p', sourceRunId: 'run', fileName: 'scopus.ris', format: 'ris' },
      { newId: sequentialIds('x'), now: fixedClock('2026-10-01T09:00:00.000Z') },
    );
    expect(batch).toEqual({
      id: 'x-1',
      projectId: 'p',
      sourceRunId: 'run',
      fileName: 'scopus.ris',
      format: 'ris',
      importedAt: '2026-10-01T09:00:00.000Z',
      recordCount: 2,
      warnings: [{ code: 'missingEnd', line: 9 }],
    });
    expect(records).toEqual([
      {
        id: 'x-2',
        projectId: 'p',
        sourceRunId: 'run',
        importBatchId: 'x-1',
        sourceLine: 1,
        csl: { title: 'A' },
        raw: 'TY  - JOUR',
        doi: '10.1/a',
      },
      {
        id: 'x-3',
        projectId: 'p',
        sourceRunId: 'run',
        importBatchId: 'x-1',
        sourceLine: 9,
        csl: { title: 'B' },
        raw: 'TY  - JOUR',
        pmid: '5',
      },
    ]);
  });
});
