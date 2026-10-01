import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { remapIds } from '../domain/exchange/remapIds';
import { makeLinkedBundle, sequentialIds } from '../domain/testing';
import type { ProjectBundle } from '../domain/types';
import { FacetReviewDB } from './db';
import {
  addProject,
  deleteProject,
  getProject,
  importBundle,
  listProjects,
  loadBundle,
  markExported,
  saveProject,
} from './projectRepository';

/** IndexedDB returns rows in key order; compare bundles independent of array order. */
function byId(bundle: ProjectBundle | undefined) {
  if (!bundle) return bundle;
  const sort = <T extends object>(rows: T[]) =>
    [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return Object.fromEntries(
    Object.entries(bundle).map(([key, value]) => [key, Array.isArray(value) ? sort(value) : value]),
  );
}

let db: FacetReviewDB;
let counter = 0;

beforeEach(() => {
  db = new FacetReviewDB(`test-${++counter}`);
});
afterEach(async () => {
  await db.delete();
});

describe('project repository', () => {
  it('adds, reads and lists projects, most recently updated first', async () => {
    const a = makeLinkedBundle().project;
    const b = { ...a, id: 'p-b', updatedAt: '2026-10-01T00:00:00.000Z' };
    await addProject(db, a);
    await addProject(db, b);
    expect(await getProject(db, a.id)).toEqual(a);
    expect((await listProjects(db)).map((p) => p.id)).toEqual(['p-b', a.id]);
  });

  it('saves edits with a new updatedAt and counts changes since export', async () => {
    const project = makeLinkedBundle().project;
    await addProject(db, project);
    await saveProject(db, { ...project, title: 'Edited' }, '2026-10-02T00:00:00.000Z');
    await saveProject(db, { ...project, title: 'Edited again' }, '2026-10-03T00:00:00.000Z');
    const stored = await getProject(db, project.id);
    expect(stored?.title).toBe('Edited again');
    expect(stored?.updatedAt).toBe('2026-10-03T00:00:00.000Z');
    expect(stored?.backup.changesSinceExport).toBe(2);
  });

  it('marks an export without touching updatedAt', async () => {
    const project = makeLinkedBundle().project;
    await addProject(db, project);
    await saveProject(db, project, '2026-10-02T00:00:00.000Z');
    await markExported(db, project.id, '2026-10-05T00:00:00.000Z');
    const stored = await getProject(db, project.id);
    expect(stored?.backup).toEqual({
      lastExportedAt: '2026-10-05T00:00:00.000Z',
      changesSinceExport: 0,
    });
    expect(stored?.updatedAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('never lets a stale draft overwrite backup bookkeeping', async () => {
    const project = makeLinkedBundle().project;
    await addProject(db, project);
    await markExported(db, project.id, '2026-10-05T00:00:00.000Z');
    // `project` still carries the pre-export backup state, like an open form would.
    await saveProject(db, { ...project, title: 'Edited' }, '2026-10-06T00:00:00.000Z');
    expect((await getProject(db, project.id))?.backup).toEqual({
      lastExportedAt: '2026-10-05T00:00:00.000Z',
      changesSinceExport: 1,
    });
  });

  it('round-trips a complete bundle through the database', async () => {
    const bundle = makeLinkedBundle();
    await importBundle(db, bundle, 'new');
    expect(await loadBundle(db, bundle.project.id)).toEqual(bundle);
  });

  it('returns undefined for unknown projects', async () => {
    expect(await getProject(db, 'missing')).toBeUndefined();
    expect(await loadBundle(db, 'missing')).toBeUndefined();
  });

  it('deletes a project with all its data and leaves other projects intact', async () => {
    const bundle = makeLinkedBundle();
    const other = remapIds(bundle, sequentialIds('other'));
    await importBundle(db, bundle, 'new');
    await importBundle(db, other, 'new');

    await deleteProject(db, bundle.project.id);

    const tables = [
      db.sources,
      db.sourceRuns,
      db.records,
      db.duplicateGroups,
      db.decisions,
      db.studies,
      db.checklist,
    ];
    for (const table of tables) {
      expect(await table.where('projectId').equals(bundle.project.id).count()).toBe(0);
    }
    expect(await getProject(db, bundle.project.id)).toBeUndefined();
    expect(byId(await loadBundle(db, other.project.id))).toEqual(byId(other));
  });

  it('refuses to import a new project over an existing id', async () => {
    const bundle = makeLinkedBundle();
    await importBundle(db, bundle, 'new');
    await expect(importBundle(db, bundle, 'new')).rejects.toThrow();
    expect(await db.records.count()).toBe(2);
  });

  it('replaces an existing project completely', async () => {
    const bundle = makeLinkedBundle();
    await importBundle(db, bundle, 'new');
    const replacement = {
      ...bundle,
      project: { ...bundle.project, title: 'Replaced' },
      records: bundle.records.slice(0, 1),
      duplicateGroups: [],
    };
    await importBundle(db, replacement, 'replace');
    expect(await loadBundle(db, bundle.project.id)).toEqual(replacement);
  });
});
