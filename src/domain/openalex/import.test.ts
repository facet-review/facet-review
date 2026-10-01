import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../testing';
import type { Source } from '../types';
import { createOpenAlexImport, findOpenAlexSource } from './import';
import type { OpenAlexQuery } from './types';

const query: OpenAlexQuery = {
  text: 'tutoring',
  field: 'title',
  types: [],
  languages: [],
  openAccessOnly: false,
};
const result = {
  count: 2,
  works: [
    { id: 'W1', display_name: 'One', doi: 'https://doi.org/10.5555/one' },
    { id: 'W2', display_name: 'Two' },
  ],
};
const label = (key: string) => key;
const deps = () => ({ newId: sequentialIds(), now: fixedClock('2026-10-01T09:00:00.000Z') });
const openAlex: Source = {
  id: 'oa',
  projectId: 'p1',
  type: 'database',
  name: 'OpenAlex',
  platform: 'OpenAlex API',
};

describe('findOpenAlexSource', () => {
  it('finds only the database source named OpenAlex on the OpenAlex API', () => {
    expect(findOpenAlexSource([openAlex])).toBe(openAlex);
    expect(findOpenAlexSource([{ ...openAlex, platform: 'Web' }])).toBeUndefined();
    expect(findOpenAlexSource([{ ...openAlex, type: 'search_engine' }])).toBeUndefined();
    expect(findOpenAlexSource([])).toBeUndefined();
  });
});

describe('createOpenAlexImport', () => {
  it('creates the source the first time and links run, batch and records', () => {
    const data = createOpenAlexImport(
      query,
      result,
      { projectId: 'p1', sources: [], date: '2026-10-01', label },
      deps(),
    );
    expect(data.newSource).toEqual({ ...openAlex, id: 'id-1' });
    expect(data.run).toMatchObject({
      id: 'id-2',
      sourceId: 'id-1',
      date: '2026-10-01',
      searchString: 'title.search:tutoring',
      reportedHits: 2,
      noLimits: true,
    });
    expect(data.batch).toMatchObject({
      sourceRunId: 'id-2',
      format: 'openalex',
      recordCount: 2,
      importedAt: '2026-10-01T09:00:00.000Z',
      warnings: [],
    });
    expect(data.batch.fileName).toMatch(/^https:\/\/api\.openalex\.org\/works\?/);
    expect(data.records.map((r) => [r.sourceRunId, r.importBatchId, r.sourceLine, r.doi])).toEqual([
      ['id-2', data.batch.id, 1, '10.5555/one'],
      ['id-2', data.batch.id, 2, undefined],
    ]);
  });

  it('reuses an existing OpenAlex source', () => {
    const data = createOpenAlexImport(
      query,
      result,
      { projectId: 'p1', sources: [openAlex], date: '2026-10-01', label },
      deps(),
    );
    expect(data.newSource).toBeUndefined();
    expect(data.run.sourceId).toBe('oa');
  });
});
