import type { Result } from '../types';
import type { ImportIssue } from './issues';

export type VersionedFile = { schemaVersion: number } & Record<string, unknown>;

/** Migration from version `n` (key) to `n + 1`. Must not mutate its input. */
export type Migration = (file: VersionedFile) => Record<string, unknown>;
export type MigrationRegistry = Readonly<Record<number, Migration>>;

/**
 * Registry of the project exchange format. Every schema change adds one entry
 * (and a test) – see CLAUDE.md, Konventionen.
 */
export const PROJECT_MIGRATIONS: MigrationRegistry = {
  /** Milestone 3: import protocol and dedup decisions become part of every file. */
  1: (file) => ({
    ...file,
    importBatches: file.importBatches ?? [],
    dedupDecisions: file.dedupDecisions ?? [],
  }),
  /**
   * Milestone 4: decisions refer to all records of a screening unit; the
   * never-written record fields studyId and removedBeforeScreening are replaced
   * by decisions; projects get screening settings. Literal defaults on purpose –
   * a migration must not change when app constants do.
   */
  2: (file) => {
    const project = isObject(file.project)
      ? {
          ...file.project,
          screening: file.project.screening ?? {
            maybeToFullText: false,
            highlights: { include: [], exclude: [] },
          },
        }
      : file.project;
    const records = Array.isArray(file.records)
      ? file.records.map((record: unknown) => {
          if (!isObject(record)) return record;
          const rest = { ...record };
          delete rest.studyId;
          delete rest.removedBeforeScreening;
          return rest;
        })
      : file.records;
    const decisions = Array.isArray(file.decisions)
      ? file.decisions.map((decision: unknown) => {
          if (!isObject(decision) || typeof decision.recordId !== 'string') return decision;
          const { recordId, ...rest } = decision;
          return { ...rest, recordIds: [recordId], shownRecordId: recordId };
        })
      : file.decisions;
    return {
      ...file,
      ...(project !== undefined && { project }),
      ...(records !== undefined && { records }),
      ...(decisions !== undefined && { decisions }),
    };
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function runMigrations(
  file: VersionedFile,
  registry: MigrationRegistry,
  target: number,
): Result<VersionedFile, ImportIssue> {
  if (file.schemaVersion > target) {
    return { ok: false, errors: [{ code: 'unsupportedFutureVersion', detail: String(target) }] };
  }
  let current: VersionedFile = { ...file };
  for (let version = file.schemaVersion; version < target; version++) {
    const step = registry[version];
    if (!step) {
      return { ok: false, errors: [{ code: 'missingMigration', detail: String(version) }] };
    }
    current = { ...step(current), schemaVersion: version + 1 };
  }
  return { ok: true, value: current };
}
