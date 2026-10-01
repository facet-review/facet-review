import type { SourceRun } from '../types';

export type ReconcileStatus = 'notImported' | 'match' | 'mismatch' | 'justified' | 'noReported';

/** Check of reported against imported hits for one search run (PRD, Modul 3). */
export function reconcile(
  run: Pick<SourceRun, 'reportedHits' | 'importNote'>,
  imported: number,
): ReconcileStatus {
  if (imported === 0) return 'notImported';
  if (run.reportedHits === undefined) return 'noReported';
  if (run.reportedHits === imported) return 'match';
  return run.importNote ? 'justified' : 'mismatch';
}

/**
 * A difference must be justified before importing – unless fewer records than
 * reported were imported so far and the user states that more files follow
 * (e.g. export limits). The import page keeps showing the difference until then.
 */
export function importNoteRequired(
  reportedHits: number | undefined,
  totalAfterImport: number,
  moreFilesFollow: boolean,
): boolean {
  if (reportedHits === undefined || reportedHits === totalAfterImport) return false;
  return !(moreFilesFollow && totalAfterImport < reportedHits);
}
