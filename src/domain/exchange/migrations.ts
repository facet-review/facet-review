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
};

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
