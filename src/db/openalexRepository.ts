import type { OpenAlexImport } from '../domain/openalex/import';
import type { ISODate } from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

/**
 * Stores a completed OpenAlex search in one transaction: source (first time),
 * search run, import batch and records. Either all of it lands in the chain or
 * nothing does.
 */
export async function saveOpenAlexImport(db: FacetReviewDB, data: OpenAlexImport, now: ISODate) {
  await db.transaction(
    'rw',
    [db.projects, db.sources, db.sourceRuns, db.importBatches, db.records],
    async () => {
      if (data.newSource) await db.sources.add(data.newSource);
      await db.sourceRuns.add(data.run);
      await db.importBatches.add(data.batch);
      await db.records.bulkAdd(data.records);
      await touchProject(db, data.run.projectId, now);
    },
  );
}
