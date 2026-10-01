import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deduplicate } from '../domain/dedup/dedup';
import { createImport } from '../domain/import/createImport';
import { fixedClock, makeLinkedBundle, sequentialIds } from '../domain/testing';
import type { DedupDecision } from '../domain/types';
import { FacetReviewDB } from './db';
import {
  addDedupDecision,
  importFile,
  listImportData,
  saveDedupResult,
  saveImportNote,
  ScreeningExistsError,
  undoImport,
} from './importRepository';
import { getProject, importBundle } from './projectRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T09:00:00.000Z';

beforeEach(async () => {
  db = new FacetReviewDB(`import-test-${++counter}`);
  const bundle = makeLinkedBundle();
  // Start from a project with a search run but without imported records.
  await importBundle(
    db,
    {
      ...bundle,
      importBatches: [],
      records: [],
      duplicateGroups: [],
      dedupDecisions: [],
      decisions: [],
      studies: [],
    },
    'new',
  );
});
afterEach(async () => {
  await db.delete();
});

const projectId = () => makeLinkedBundle().project.id;

function fileImport(prefix: string, titles: string[], doi?: string) {
  return createImport(
    {
      records: titles.map((title, i) => ({
        csl: { title, author: [{ family: 'Doe' }] },
        raw: `TY  - JOUR\nTI  - ${title}`,
        line: i * 3 + 1,
        ...(doi ? { doi } : {}),
      })),
      warnings: [],
    },
    { projectId: projectId(), sourceRunId: 'run-1', fileName: `${prefix}.ris`, format: 'ris' },
    { newId: sequentialIds(prefix), now: fixedClock(NOW) },
  );
}

async function recompute() {
  const data = await listImportData(db, projectId());
  await saveDedupResult(
    db,
    projectId(),
    deduplicate(data.records, data.dedupDecisions),
    sequentialIds('g'),
  );
}

describe('import repository', () => {
  it('stores a batch with its records and counts it as a change', async () => {
    await importFile(db, fileImport('a', ['One', 'Two']), NOW);
    const data = await listImportData(db, projectId());
    expect(data.batches).toHaveLength(1);
    expect(data.records.map((r) => r.csl.title)).toEqual(['One', 'Two']);
    expect((await getProject(db, projectId()))?.backup.changesSinceExport).toBe(1);
  });

  it('stores dedup results as groups and marks member records', async () => {
    await importFile(db, fileImport('a', ['Same'], '10.1/x'), NOW);
    await importFile(db, fileImport('b', ['Same'], '10.1/x'), NOW);
    await recompute();
    const data = await listImportData(db, projectId());
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]).toMatchObject({ projectId: projectId(), rule: 'doi' });
    expect(data.records.every((r) => r.duplicateGroupId === data.groups[0]?.id)).toBe(true);
  });

  it('keeps group ids stable across recomputation and clears stale membership', async () => {
    await importFile(db, fileImport('a', ['Same'], '10.1/x'), NOW);
    await importFile(db, fileImport('b', ['Same'], '10.1/x'), NOW);
    await recompute();
    const before = (await listImportData(db, projectId())).groups[0]?.id;
    await recompute();
    expect((await listImportData(db, projectId())).groups[0]?.id).toBe(before);

    const [first, second] = (await listImportData(db, projectId())).records;
    const separate: DedupDecision = {
      id: 'dd',
      projectId: projectId(),
      recordIds: [first!.id, second!.id],
      value: 'separate',
      reviewerId: 'rev',
      timestamp: NOW,
    };
    await addDedupDecision(db, separate, NOW);
    await recompute();
    const after = await listImportData(db, projectId());
    expect(after.groups).toEqual([]);
    expect(after.records.every((r) => r.duplicateGroupId === undefined)).toBe(true);
  });

  it('undoes an import with its records and the dedup decisions about them', async () => {
    const a = fileImport('a', ['One'], '10.1/x');
    const b = fileImport('b', ['One'], '10.1/x');
    await importFile(db, a, NOW);
    await importFile(db, b, NOW);
    await addDedupDecision(
      db,
      {
        id: 'dd',
        projectId: projectId(),
        recordIds: [a.records[0]!.id, b.records[0]!.id],
        value: 'separate',
        reviewerId: 'rev',
        timestamp: NOW,
      },
      NOW,
    );
    await undoImport(db, b.batch.id, NOW);
    const data = await listImportData(db, projectId());
    expect(data.batches.map((x) => x.id)).toEqual([a.batch.id]);
    expect(data.records.map((r) => r.id)).toEqual([a.records[0]!.id]);
    expect(data.dedupDecisions).toEqual([]);
  });

  it('refuses to undo an import once records have screening decisions', async () => {
    const a = fileImport('a', ['One']);
    await importFile(db, a, NOW);
    await db.decisions.add({
      id: 'dec',
      projectId: projectId(),
      recordId: a.records[0]!.id,
      reviewerId: 'rev',
      stage: 'title_abstract',
      value: 'include',
      timestamp: NOW,
    });
    await expect(undoImport(db, a.batch.id, NOW)).rejects.toBeInstanceOf(ScreeningExistsError);
    expect((await listImportData(db, projectId())).records).toHaveLength(1);
  });

  it('saves the justification for a count discrepancy on the search run', async () => {
    await saveImportNote(db, 'run-1', 'Scopus exports at most 2,000 records per file.', NOW);
    expect((await db.sourceRuns.get('run-1'))?.importNote).toBe(
      'Scopus exports at most 2,000 records per file.',
    );
    await saveImportNote(db, 'run-1', '  ', NOW);
    expect(await db.sourceRuns.get('run-1')).not.toHaveProperty('importNote');
  });
});
