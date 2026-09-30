import { describe, expect, it } from 'vitest';
import { exportFileName, slugify } from './slug';

describe('slugify', () => {
  it('lowercases, strips diacritics and replaces separators', () => {
    expect(slugify('Über Bildungsgerechtigkeit: Café & Co.')).toBe(
      'uber-bildungsgerechtigkeit-cafe-co',
    );
  });

  it('trims leading/trailing separators and limits length', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
    expect(slugify('a'.repeat(100))).toHaveLength(60);
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('project');
    expect(slugify('')).toBe('project');
  });
});

describe('exportFileName', () => {
  it('combines product prefix, slug and date', () => {
    expect(exportFileName('My Review', '2026-09-30T12:34:56.000Z')).toBe(
      'facet-review_my-review_2026-09-30.json',
    );
  });
});
