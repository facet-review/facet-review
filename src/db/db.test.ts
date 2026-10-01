import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { FacetReviewDB } from './db';

describe('FacetReviewDB upgrade 2 → 3', () => {
  it('turns record decisions into unit decisions and adds screening settings', async () => {
    const name = 'upgrade-test';
    const old = new Dexie(name);
    old.version(2).stores({
      projects: 'id, updatedAt',
      records: 'id, projectId, sourceRunId, importBatchId, doi, pmid, duplicateGroupId',
      decisions: 'id, projectId, recordId, [recordId+stage]',
    });
    await old.table('projects').add({ id: 'p', title: 'Old' });
    await old.table('records').add({ id: 'r1', projectId: 'p', studyId: 's' });
    await old
      .table('decisions')
      .add({ id: 'd1', projectId: 'p', recordId: 'r1', value: 'include' });
    old.close();

    const db = new FacetReviewDB(name);
    expect(await db.projects.get('p')).toEqual({
      id: 'p',
      title: 'Old',
      screening: { maybeToFullText: false, highlights: { include: [], exclude: [] } },
    });
    expect(await db.records.get('r1')).toEqual({ id: 'r1', projectId: 'p' });
    expect(await db.decisions.get('d1')).toEqual({
      id: 'd1',
      projectId: 'p',
      recordIds: ['r1'],
      shownRecordId: 'r1',
      value: 'include',
    });
    expect(await db.decisions.where('recordIds').equals('r1').count()).toBe(1);
    db.close();
  });
});
