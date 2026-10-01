import type { DedupResult } from '../domain/dedup/dedup';
import { assignGroupIds } from '../domain/dedup/groupIds';
import type {
  BibRecord,
  DedupDecision,
  DuplicateGroup,
  ImportBatch,
  ISODate,
  UUID,
} from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

/** Undoing would orphan screening decisions (from milestone 4 on). */
export class ScreeningExistsError extends Error {
  constructor() {
    super('Records of this import already have screening decisions');
  }
}

export interface ImportData {
  batches: ImportBatch[];
  records: BibRecord[];
  groups: DuplicateGroup[];
  dedupDecisions: DedupDecision[];
}

export async function listImportData(db: FacetReviewDB, projectId: UUID): Promise<ImportData> {
  return db.transaction(
    'r',
    [db.importBatches, db.records, db.duplicateGroups, db.dedupDecisions],
    async () => ({
      batches: await db.importBatches.where('projectId').equals(projectId).toArray(),
      records: await db.records.where('projectId').equals(projectId).toArray(),
      groups: await db.duplicateGroups.where('projectId').equals(projectId).toArray(),
      dedupDecisions: await db.dedupDecisions.where('projectId').equals(projectId).toArray(),
    }),
  );
}

/** Stores one imported file atomically. */
export async function importFile(
  db: FacetReviewDB,
  data: { batch: ImportBatch; records: BibRecord[] },
  now: ISODate,
) {
  await db.transaction('rw', [db.projects, db.importBatches, db.records], async () => {
    await db.importBatches.add(data.batch);
    await db.records.bulkAdd(data.records);
    await touchProject(db, data.batch.projectId, now);
  });
}

/** Removes an imported file, its records and the dedup decisions about them. */
export async function undoImport(db: FacetReviewDB, batchId: UUID, now: ISODate) {
  await db.transaction(
    'rw',
    [db.projects, db.importBatches, db.records, db.dedupDecisions, db.decisions],
    async () => {
      const batch = await db.importBatches.get(batchId);
      if (!batch) return;
      const recordIds = (await db.records
        .where('importBatchId')
        .equals(batchId)
        .primaryKeys()) as UUID[];
      const ids = new Set(recordIds);
      if ((await db.decisions.where('recordIds').anyOf(recordIds).count()) > 0) {
        throw new ScreeningExistsError();
      }
      const affected = await db.dedupDecisions
        .where('projectId')
        .equals(batch.projectId)
        .filter((decision) => decision.recordIds.some((id) => ids.has(id)))
        .primaryKeys();
      await db.dedupDecisions.bulkDelete(affected);
      await db.records.bulkDelete(recordIds);
      await db.importBatches.delete(batchId);
      await touchProject(db, batch.projectId, now);
    },
  );
}

/** Appends a dedup decision (audit trail; the latest decision per pair wins). */
export async function addDedupDecision(db: FacetReviewDB, decision: DedupDecision, now: ISODate) {
  await db.transaction('rw', [db.projects, db.dedupDecisions], async () => {
    await db.dedupDecisions.add(decision);
    await touchProject(db, decision.projectId, now);
  });
}

/**
 * Replaces the stored groups of a project with a recomputed result and updates
 * `duplicateGroupId` on records. Derived data – not counted as a user change.
 */
export async function saveDedupResult(
  db: FacetReviewDB,
  projectId: UUID,
  result: DedupResult,
  newId: () => UUID,
) {
  await db.transaction('rw', [db.duplicateGroups, db.records], async () => {
    const existing = await db.duplicateGroups.where('projectId').equals(projectId).toArray();
    const groups = assignGroupIds(projectId, result.groups, existing, newId);
    await db.duplicateGroups.bulkDelete(existing.map((group) => group.id));
    await db.duplicateGroups.bulkAdd(groups);

    const membership = new Map<UUID, UUID>();
    for (const group of groups) for (const id of group.memberIds) membership.set(id, group.id);
    await db.records
      .where('projectId')
      .equals(projectId)
      .modify((record) => {
        const groupId = membership.get(record.id);
        if (groupId) record.duplicateGroupId = groupId;
        else delete record.duplicateGroupId;
      });
  });
}

/** Justification for a difference between reported and imported numbers (PRD, Modul 3). */
export async function saveImportNote(db: FacetReviewDB, runId: UUID, note: string, now: ISODate) {
  await db.transaction('rw', [db.projects, db.sourceRuns], async () => {
    const run = await db.sourceRuns.get(runId);
    if (!run) return;
    const text = note.trim();
    const { importNote: _previous, ...rest } = run;
    void _previous;
    await db.sourceRuns.put(text ? { ...rest, importNote: text } : rest);
    await touchProject(db, run.projectId, now);
  });
}
