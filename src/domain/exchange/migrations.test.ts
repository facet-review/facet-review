import { describe, expect, it } from 'vitest';
import { runMigrations, type MigrationRegistry } from './migrations';

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
