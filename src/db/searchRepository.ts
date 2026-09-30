import type { ISODate, Project, Source, SourceRun, UUID } from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

/** Deleting would break the chain search → imported records. */
export class RecordsExistError extends Error {
  readonly count: number;
  constructor(count: number) {
    super(`${count} imported records depend on this search`);
    this.count = count;
  }
}

export function listSources(db: FacetReviewDB, projectId: UUID): Promise<Source[]> {
  return db.sources.where('projectId').equals(projectId).toArray();
}

export function listRuns(db: FacetReviewDB, projectId: UUID): Promise<SourceRun[]> {
  return db.sourceRuns.where('projectId').equals(projectId).toArray();
}

export async function saveSource(db: FacetReviewDB, source: Source, now: ISODate) {
  await db.transaction('rw', db.projects, db.sources, async () => {
    await db.sources.put(source);
    await touchProject(db, source.projectId, now);
  });
}

export async function saveRun(db: FacetReviewDB, run: SourceRun, now: ISODate) {
  await db.transaction('rw', db.projects, db.sourceRuns, async () => {
    await db.sourceRuns.put(run);
    await touchProject(db, run.projectId, now);
  });
}

async function importedRecordCount(db: FacetReviewDB, runIds: readonly UUID[]) {
  return runIds.length === 0 ? 0 : db.records.where('sourceRunId').anyOf(runIds).count();
}

/** Deletes a run unless records were imported from it. */
export async function deleteRun(db: FacetReviewDB, runId: UUID, now: ISODate) {
  await db.transaction('rw', db.projects, db.sourceRuns, db.records, async () => {
    const run = await db.sourceRuns.get(runId);
    if (!run) return;
    const count = await importedRecordCount(db, [runId]);
    if (count > 0) throw new RecordsExistError(count);
    await db.sourceRuns.delete(runId);
    await touchProject(db, run.projectId, now);
  });
}

/** Deletes a source with all its runs, unless records were imported from any of them. */
export async function deleteSource(db: FacetReviewDB, sourceId: UUID, now: ISODate) {
  await db.transaction('rw', [db.projects, db.sources, db.sourceRuns, db.records], async () => {
    const source = await db.sources.get(sourceId);
    if (!source) return;
    const runIds = (await db.sourceRuns.where('sourceId').equals(sourceId).primaryKeys()) as UUID[];
    const count = await importedRecordCount(db, runIds);
    if (count > 0) throw new RecordsExistError(count);
    await db.sourceRuns.bulkDelete(runIds);
    await db.sources.delete(sourceId);
    await touchProject(db, source.projectId, now);
  });
}

/** Project-wide search information (PRISMA-S items 10, 11, 12, 14); leaves the rest of the project untouched. */
export async function updateSearchMeta(
  db: FacetReviewDB,
  projectId: UUID,
  searchMeta: Project['searchMeta'],
  now: ISODate,
) {
  await db.transaction('rw', db.projects, async () => {
    await db.projects.update(projectId, { searchMeta });
    await touchProject(db, projectId, now);
  });
}
