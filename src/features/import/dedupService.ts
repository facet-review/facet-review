import { db } from '../../db/db';
import { listImportData, saveDedupResult } from '../../db/importRepository';
import type { DedupResult } from '../../domain/dedup/dedup';
import { newId } from '../../app/runtime';
import { dedupInWorker } from './worker/client';

/** Recomputes groups from all records and decisions and stores them (after imports and decisions). */
export async function recomputeDuplicates(projectId: string): Promise<DedupResult> {
  const data = await listImportData(db, projectId);
  const result = await dedupInWorker(
    data.records.map(({ id, csl, doi, pmid }) => ({ id, csl, doi, pmid })),
    data.dedupDecisions,
  );
  await saveDedupResult(db, projectId, result, newId);
  return result;
}
