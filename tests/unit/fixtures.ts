import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFile } from '../../src/domain/import/parseFile';
import type { ImportFormat } from '../../src/domain/types';

const ROOT = resolve(import.meta.dirname, '../fixtures');

export function readFixture(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

export function parseFixture(path: string, format: ImportFormat) {
  return parseFile(readFixture(path), format);
}

/** Synthetic records carry their case label in the abstract: "Synthetic test record A1." */
export function labelOf(abstract: unknown): string | undefined {
  return typeof abstract === 'string'
    ? abstract.match(/Synthetic test record ([A-Z][A-Za-z0-9-]*)\./)?.[1]
    : undefined;
}
