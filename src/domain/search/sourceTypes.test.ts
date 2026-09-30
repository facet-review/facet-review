import { describe, expect, it } from 'vitest';
import type { SourceType } from '../types';
import { SOURCE_TYPES, SOURCE_TYPE_CONFIG, flowColumn } from './sourceTypes';

describe('SOURCE_TYPE_CONFIG', () => {
  it('covers every source type exactly once, in reporting order', () => {
    expect(SOURCE_TYPES).toEqual([
      'database',
      'register',
      'search_engine',
      'website',
      'citation_search',
      'contact',
      'other',
    ]);
    expect(Object.keys(SOURCE_TYPE_CONFIG).sort()).toEqual([...SOURCE_TYPES].sort());
  });

  it('maps each type to its PRISMA-S item', () => {
    const items = Object.fromEntries(SOURCE_TYPES.map((t) => [t, SOURCE_TYPE_CONFIG[t].prismaS]));
    expect(items).toEqual({
      database: ['1', '2'],
      register: ['3'],
      search_engine: ['4'],
      website: ['4'],
      citation_search: ['5'],
      contact: ['6'],
      other: ['7'],
    });
  });

  it('only requires fields that are also shown', () => {
    for (const type of SOURCE_TYPES) {
      const config = SOURCE_TYPE_CONFIG[type];
      expect(config.sourceFields).toEqual(expect.arrayContaining([...config.requiredSourceFields]));
      expect(config.runFields).toEqual(expect.arrayContaining([...config.requiredRunFields]));
    }
  });

  it('requires the fields named in the PRD table', () => {
    const required = (type: SourceType) => [
      ...SOURCE_TYPE_CONFIG[type].requiredSourceFields,
      ...SOURCE_TYPE_CONFIG[type].requiredRunFields,
    ];
    expect(required('database')).toEqual(['name', 'platform', 'searchString', 'reportedHits']);
    expect(required('register')).toEqual(['name', 'searchString', 'reportedHits']);
    expect(required('website')).toEqual(['name', 'url', 'method', 'reportedHits']);
    expect(required('search_engine')).toEqual(['name', 'searchString', 'recordsChecked', 'tool']);
    expect(required('citation_search')).toEqual([
      'name',
      'citationDirection',
      'seedDocuments',
      'tool',
    ]);
    expect(required('contact')).toEqual(['name', 'description']);
    expect(required('other')).toEqual(['name', 'description']);
  });
});

describe('flowColumn', () => {
  it('puts databases, registers and search engines in the left column', () => {
    expect(flowColumn('database')).toBe('databases_registers');
    expect(flowColumn('register')).toBe('databases_registers');
    // Common reporting practice: Google Scholar & co. are reported with the databases.
    expect(flowColumn('search_engine')).toBe('databases_registers');
  });

  it('puts all other methods in the right column', () => {
    for (const type of ['website', 'citation_search', 'contact', 'other'] as const) {
      expect(flowColumn(type)).toBe('other_methods');
    }
  });
});
