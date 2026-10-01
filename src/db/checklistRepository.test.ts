import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../domain/testing';
import { listChecklist, saveChecklistEntry } from './checklistRepository';
import { FacetReviewDB } from './db';
import { importBundle } from './projectRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T09:00:00.000Z';
const bundle = makeLinkedBundle();
const projectId = bundle.project.id;

beforeEach(async () => {
  db = new FacetReviewDB(`checklist-test-${++counter}`);
  await importBundle(db, { ...bundle, checklist: [] }, 'new');
});

describe('checklistRepository', () => {
  it('stores one entry per item and counts each save as a change', async () => {
    await saveChecklistEntry(db, { projectId, itemId: '6', status: 'done', location: 'p. 4' }, NOW);
    await saveChecklistEntry(db, { projectId, itemId: '6', status: 'na', location: '' }, NOW);
    expect(await listChecklist(db, projectId)).toEqual([{ projectId, itemId: '6', status: 'na' }]);
    expect((await db.projects.get(projectId))?.backup.changesSinceExport).toBe(2);
  });

  it('trims text and drops empty fields', async () => {
    await saveChecklistEntry(
      db,
      { projectId, itemId: '7', status: 'open', location: '  Appendix ', note: '  ' },
      NOW,
    );
    expect(await listChecklist(db, projectId)).toEqual([
      { projectId, itemId: '7', status: 'open', location: 'Appendix' },
    ]);
  });
});
