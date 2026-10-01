import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOpenAlexImport } from '../domain/openalex/import';
import { fixedClock, makeLinkedBundle, sequentialIds } from '../domain/testing';
import { FacetReviewDB } from './db';
import { addProject, getProject } from './projectRepository';
import { saveOpenAlexImport } from './openalexRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T09:00:00.000Z';

beforeEach(() => {
  db = new FacetReviewDB(`openalex-test-${++counter}`);
});
afterEach(async () => {
  await db.delete();
});

const query = {
  text: 'tutoring',
  field: 'title' as const,
  types: [],
  languages: [],
  openAccessOnly: false,
};

async function search(projectId: string, prefix: string) {
  return createOpenAlexImport(
    query,
    { count: 1, works: [{ id: `W-${prefix}`, display_name: 'One' }] },
    {
      projectId,
      sources: await db.sources.where('projectId').equals(projectId).toArray(),
      date: '2026-10-01',
      label: (key) => key,
    },
    { newId: sequentialIds(prefix), now: fixedClock(NOW) },
  );
}

describe('saveOpenAlexImport', () => {
  it('stores source, run, batch and records together and counts as a change', async () => {
    const { project } = makeLinkedBundle();
    await addProject(db, project);
    await saveOpenAlexImport(db, await search(project.id, 'a'), NOW);
    await saveOpenAlexImport(db, await search(project.id, 'b'), NOW);

    expect(await db.sources.where('projectId').equals(project.id).count()).toBe(1);
    expect(await db.sourceRuns.where('projectId').equals(project.id).count()).toBe(2);
    expect(await db.importBatches.where('projectId').equals(project.id).count()).toBe(2);
    expect(await db.records.where('projectId').equals(project.id).count()).toBe(2);
    const stored = await getProject(db, project.id);
    expect(stored?.backup.changesSinceExport).toBe(project.backup.changesSinceExport + 2);
  });

  it('stores nothing when any part fails', async () => {
    const { project } = makeLinkedBundle();
    await addProject(db, project);
    const data = await search(project.id, 'a');
    // A clashing record id makes bulkAdd fail inside the transaction.
    await db.records.add({ ...data.records[0]!, importBatchId: 'other' });
    await expect(saveOpenAlexImport(db, data, NOW)).rejects.toThrow();
    expect(await db.sources.count()).toBe(0);
    expect(await db.sourceRuns.count()).toBe(0);
    expect(await db.importBatches.count()).toBe(0);
  });
});
