import type { SourceType } from '../types';

export type SourceField = 'name' | 'platform' | 'url' | 'databases';
export type RunField =
  | 'searchString'
  | 'limits'
  | 'reportedHits'
  | 'tool'
  | 'method'
  | 'recordsChecked'
  | 'citationDirection'
  | 'seedDocuments'
  | 'description'
  | 'dateTo'
  | 'notes';

/** Column of the PRISMA 2020 flow diagram a source feeds into. */
export type FlowColumn = 'databases_registers' | 'other_methods';

export interface SourceTypeConfig {
  /** PRISMA-S checklist items documented by this source type. */
  prismaS: readonly string[];
  flowColumn: FlowColumn;
  sourceFields: readonly SourceField[];
  requiredSourceFields: readonly SourceField[];
  runFields: readonly RunField[];
  requiredRunFields: readonly RunField[];
}

/** Reporting order: identification via databases and registers first, then other methods. */
export const SOURCE_TYPES = [
  'database',
  'register',
  'search_engine',
  'website',
  'citation_search',
  'contact',
  'other',
] as const satisfies readonly SourceType[];

/**
 * Fields per source type (PRD, Modul 2). The date is required for every run and
 * therefore not listed. Search engines are reported with databases and registers,
 * following common reporting practice (decision of 2026-09-30).
 */
export const SOURCE_TYPE_CONFIG: Record<SourceType, SourceTypeConfig> = {
  database: {
    prismaS: ['1', '2'],
    flowColumn: 'databases_registers',
    sourceFields: ['name', 'platform', 'databases'],
    requiredSourceFields: ['name', 'platform'],
    runFields: ['searchString', 'limits', 'reportedHits', 'notes'],
    requiredRunFields: ['searchString', 'reportedHits'],
  },
  register: {
    prismaS: ['3'],
    flowColumn: 'databases_registers',
    sourceFields: ['name', 'url'],
    requiredSourceFields: ['name'],
    runFields: ['searchString', 'limits', 'reportedHits', 'notes'],
    requiredRunFields: ['searchString', 'reportedHits'],
  },
  search_engine: {
    prismaS: ['4'],
    flowColumn: 'databases_registers',
    sourceFields: ['name', 'url'],
    requiredSourceFields: ['name'],
    runFields: ['searchString', 'limits', 'reportedHits', 'recordsChecked', 'tool', 'notes'],
    requiredRunFields: ['searchString', 'recordsChecked', 'tool'],
  },
  website: {
    prismaS: ['4'],
    flowColumn: 'other_methods',
    sourceFields: ['name', 'url'],
    requiredSourceFields: ['name', 'url'],
    runFields: ['method', 'searchString', 'reportedHits', 'dateTo', 'notes'],
    requiredRunFields: ['method', 'reportedHits'],
  },
  citation_search: {
    prismaS: ['5'],
    flowColumn: 'other_methods',
    sourceFields: ['name'],
    requiredSourceFields: ['name'],
    runFields: ['citationDirection', 'seedDocuments', 'tool', 'reportedHits', 'dateTo', 'notes'],
    requiredRunFields: ['citationDirection', 'seedDocuments', 'tool'],
  },
  contact: {
    prismaS: ['6'],
    flowColumn: 'other_methods',
    sourceFields: ['name'],
    requiredSourceFields: ['name'],
    runFields: ['description', 'reportedHits', 'dateTo', 'notes'],
    requiredRunFields: ['description'],
  },
  other: {
    prismaS: ['7'],
    flowColumn: 'other_methods',
    sourceFields: ['name'],
    requiredSourceFields: ['name'],
    runFields: ['description', 'reportedHits', 'dateTo', 'notes'],
    requiredRunFields: ['description'],
  },
};

export function flowColumn(type: SourceType): FlowColumn {
  return SOURCE_TYPE_CONFIG[type].flowColumn;
}
