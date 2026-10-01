import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import { listImportData } from '../../db/importRepository';
import type { DedupResult } from '../../domain/dedup/dedup';
import { dedupInWorker } from './worker/client';

/** Batches, records, stored groups and decisions of a project, live-updating. */
export function useImportData(projectId: string) {
  return useLiveQuery(() => listImportData(db, projectId), [projectId]);
}

/**
 * Current dedup state (groups, open candidates, stats), computed in the worker
 * from records and decisions whenever they change. Read-only.
 */
export function useDedupPreview(projectId: string): DedupResult | undefined {
  const input = useLiveQuery(async () => {
    const data = await listImportData(db, projectId);
    return {
      records: data.records.map(({ id, csl, doi, pmid }) => ({ id, csl, doi, pmid })),
      decisions: data.dedupDecisions,
    };
  }, [projectId]);
  const [result, setResult] = useState<DedupResult>();
  useEffect(() => {
    if (!input) return;
    let cancelled = false;
    void dedupInWorker(input.records, input.decisions).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [input]);
  return result;
}
