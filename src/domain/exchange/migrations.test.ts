import { describe, expect, it } from 'vitest';
import { PROJECT_MIGRATIONS, runMigrations, type MigrationRegistry } from './migrations';

const registry: MigrationRegistry = {
  1: (file) => ({ ...file, renamed: file.old, old: undefined }),
  2: (file) => ({ ...file, added: true }),
};

describe('runMigrations', () => {
  it('applies each step from the file version up to the target', () => {
    const result = runMigrations({ schemaVersion: 1, old: 'x' }, registry, 3);
    expect(result).toEqual({
      ok: true,
      value: { schemaVersion: 3, renamed: 'x', old: undefined, added: true },
    });
  });

  it('starts at the file version, not at 1', () => {
    expect(runMigrations({ schemaVersion: 2 }, registry, 3)).toEqual({
      ok: true,
      value: { schemaVersion: 3, added: true },
    });
  });

  it('is a no-op for current files', () => {
    expect(runMigrations({ schemaVersion: 3, a: 1 }, registry, 3)).toEqual({
      ok: true,
      value: { schemaVersion: 3, a: 1 },
    });
  });

  it('fails if a step is missing', () => {
    expect(runMigrations({ schemaVersion: 1 }, { 2: registry[2]! }, 3)).toEqual({
      ok: false,
      errors: [{ code: 'missingMigration', detail: '1' }],
    });
  });

  it('refuses to downgrade files from a newer version', () => {
    expect(runMigrations({ schemaVersion: 4 }, registry, 3)).toEqual({
      ok: false,
      errors: [{ code: 'unsupportedFutureVersion', detail: '3' }],
    });
  });

  it('does not mutate the input', () => {
    const file = { schemaVersion: 2 };
    runMigrations(file, registry, 3);
    expect(file).toEqual({ schemaVersion: 2 });
  });
});

describe('PROJECT_MIGRATIONS', () => {
  it('1 → 2 adds empty import batches and dedup decisions, keeping everything else', () => {
    const v1 = { schemaVersion: 1, format: 'facet-review-project', sources: [{ id: 's' }] };
    expect(runMigrations(v1, PROJECT_MIGRATIONS, 2)).toEqual({
      ok: true,
      value: {
        schemaVersion: 2,
        format: 'facet-review-project',
        sources: [{ id: 's' }],
        importBatches: [],
        dedupDecisions: [],
      },
    });
  });

  it('1 → 2 keeps existing collections if a file already has them', () => {
    const v1 = { schemaVersion: 1, importBatches: [{ id: 'b' }] };
    const result = runMigrations(v1, PROJECT_MIGRATIONS, 2);
    expect(result.ok && result.value.importBatches).toEqual([{ id: 'b' }]);
  });

  it('2 → 3 turns record decisions into unit decisions and adds screening settings', () => {
    const v2 = {
      schemaVersion: 2,
      project: { id: 'p', title: 'T' },
      records: [{ id: 'r1', studyId: 's', removedBeforeScreening: { by: 'other', reason: 'x' } }],
      decisions: [{ id: 'd1', recordId: 'r1', stage: 'title_abstract', value: 'include' }],
    };
    expect(runMigrations(v2, PROJECT_MIGRATIONS, 3)).toEqual({
      ok: true,
      value: {
        schemaVersion: 3,
        project: {
          id: 'p',
          title: 'T',
          screening: { maybeToFullText: false, highlights: { include: [], exclude: [] } },
        },
        records: [{ id: 'r1' }],
        decisions: [
          {
            id: 'd1',
            recordIds: ['r1'],
            shownRecordId: 'r1',
            stage: 'title_abstract',
            value: 'include',
          },
        ],
      },
    });
  });

  it('2 → 3 leaves malformed entries for validation to report', () => {
    const v2 = { schemaVersion: 2, project: null, records: 'x', decisions: [null, { id: 'd' }] };
    expect(runMigrations(v2, PROJECT_MIGRATIONS, 3)).toEqual({
      ok: true,
      value: { schemaVersion: 3, project: null, records: 'x', decisions: [null, { id: 'd' }] },
    });
  });

  it('2 → 3 keeps screening settings a file already has', () => {
    const settings = { maybeToFullText: true, highlights: { include: ['a'], exclude: [] } };
    const result = runMigrations(
      { schemaVersion: 2, project: { id: 'p', screening: settings } },
      PROJECT_MIGRATIONS,
      3,
    );
    expect(result.ok && result.value.project).toEqual({ id: 'p', screening: settings });
  });
});
