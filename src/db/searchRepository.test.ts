import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../domain/testing';
import type { Source, SourceRun } from '../domain/types';
import { FacetReviewDB } from './db';
import { addProject, getProject, importBundle } from './projectRepository';
import {
  deleteRun,
  deleteSource,
  listRuns,
  listSources,
  RecordsExistError,
  saveRun,
  saveSource,
  updateSearchMeta,
} from './searchRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T08:00:00.000Z';

beforeEach(() => {
  db = new FacetReviewDB(`search-test-${++counter}`);
});
afterEach(async () => {
  await db.delete();
});

async function projectOnly() {
  const { project } = makeLinkedBundle();
  await addProject(db, project);
  return project;
}

const source = (projectId: string, id = 's-1'): Source => ({
  id,
  projectId,
  type: 'database',
  name: 'Scopus',
  platform: 'Elsevier',
});
const run = (projectId: string, id: string, sourceId = 's-1'): SourceRun => ({
  id,
  projectId,
  sourceId,
  date: '2026-09-30',
  searchString: 'TITLE-ABS-KEY(tutoring)',
  reportedHits: 42,
});

describe('search repository', () => {
  it('saves and lists sources and runs of a project', async () => {
    const project = await projectOnly();
    await saveSource(db, source(project.id), NOW);
    await saveRun(db, run(project.id, 'r-1'), NOW);
    await saveRun(db, { ...run(project.id, 'r-2'), date: '2026-10-01' }, NOW);
    expect(await listSources(db, project.id)).toEqual([source(project.id)]);
    expect((await listRuns(db, project.id)).map((r) => r.id)).toEqual(['r-1', 'r-2']);
  });

  it('counts every search change as a project change', async () => {
    const project = await projectOnly();
    await saveSource(db, source(project.id), NOW);
    await saveRun(db, run(project.id, 'r-1'), NOW);
    await deleteRun(db, 'r-1', NOW);
    const stored = await getProject(db, project.id);
    expect(stored?.backup.changesSinceExport).toBe(3);
    expect(stored?.updatedAt).toBe(NOW);
  });

  it('updates only the project-wide search information', async () => {
    const project = await projectOnly();
    await updateSearchMeta(db, project.id, { peerReview: 'PRESS by a librarian' }, NOW);
    const stored = await getProject(db, project.id);
    expect(stored?.searchMeta).toEqual({ peerReview: 'PRESS by a librarian' });
    expect(stored?.title).toBe(project.title);
    expect(stored?.backup.changesSinceExport).toBe(1);
  });

  it('deletes a source together with its runs', async () => {
    const project = await projectOnly();
    await saveSource(db, source(project.id), NOW);
    await saveSource(db, source(project.id, 's-2'), NOW);
    await saveRun(db, run(project.id, 'r-1'), NOW);
    await saveRun(db, run(project.id, 'r-2', 's-2'), NOW);
    await deleteSource(db, 's-1', NOW);
    expect((await listSources(db, project.id)).map((s) => s.id)).toEqual(['s-2']);
    expect((await listRuns(db, project.id)).map((r) => r.id)).toEqual(['r-2']);
  });

  it('refuses to delete runs or sources that records were imported from', async () => {
    // The linked bundle contains records imported from run-1 of src-1.
    const bundle = makeLinkedBundle();
    await importBundle(db, bundle, 'new');
    await expect(deleteRun(db, 'run-1', NOW)).rejects.toBeInstanceOf(RecordsExistError);
    await expect(deleteSource(db, 'src-1', NOW)).rejects.toBeInstanceOf(RecordsExistError);
    expect(await listRuns(db, bundle.project.id)).toHaveLength(1);
    expect(await listSources(db, bundle.project.id)).toHaveLength(1);
    expect((await getProject(db, bundle.project.id))?.backup.changesSinceExport).toBe(0);
  });

  it('ignores deletes of unknown ids', async () => {
    await expect(deleteRun(db, 'missing', NOW)).resolves.toBeUndefined();
    await expect(deleteSource(db, 'missing', NOW)).resolves.toBeUndefined();
  });
});
