import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../domain/testing';
import { FacetReviewDB } from './db';
import { saveFlowOverrides } from './flowRepository';
import { importBundle } from './projectRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T09:00:00.000Z';
const bundle = makeLinkedBundle();
const projectId = bundle.project.id;

beforeEach(async () => {
  db = new FacetReviewDB(`flow-test-${++counter}`);
  await importBundle(db, bundle, 'new');
});

describe('saveFlowOverrides', () => {
  it('stores the variant and manual numbers and counts it as a change', async () => {
    await saveFlowOverrides(
      db,
      projectId,
      { variant: 'update_db', previousStudies: 4, previousReports: undefined },
      NOW,
    );
    const project = await db.projects.get(projectId);
    expect(project?.flowOverrides).toEqual({ variant: 'update_db', previousStudies: 4 });
    expect(project?.backup.changesSinceExport).toBe(1);
  });

  it('removes the overrides when nothing is left', async () => {
    await saveFlowOverrides(db, projectId, { variant: 'new_db' }, NOW);
    await saveFlowOverrides(db, projectId, { variant: undefined }, NOW);
    expect(await db.projects.get(projectId)).not.toHaveProperty('flowOverrides');
  });

  it('ignores unknown projects', async () => {
    await saveFlowOverrides(db, 'missing', { previousStudies: 1 }, NOW);
    expect(await db.projects.count()).toBe(1);
  });
});
