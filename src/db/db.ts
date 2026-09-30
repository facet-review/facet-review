import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  BibRecord,
  ChecklistEntry,
  Decision,
  DuplicateGroup,
  Project,
  Source,
  SourceRun,
  Study,
} from '../domain/types';

/**
 * IndexedDB schema. The Dexie version describes the database layout in the
 * browser; it is independent of `schemaVersion` of the JSON exchange format.
 * Every child table is indexed by `projectId` for export and cascading deletion.
 */
export class FacetReviewDB extends Dexie {
  declare projects: EntityTable<Project, 'id'>;
  declare sources: EntityTable<Source, 'id'>;
  declare sourceRuns: EntityTable<SourceRun, 'id'>;
  declare records: EntityTable<BibRecord, 'id'>;
  declare duplicateGroups: EntityTable<DuplicateGroup, 'id'>;
  declare decisions: EntityTable<Decision, 'id'>;
  declare studies: EntityTable<Study, 'id'>;
  declare checklist: Table<ChecklistEntry, [string, string]>;

  constructor(name = 'facet-review') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
      sources: 'id, projectId',
      sourceRuns: 'id, projectId, sourceId',
      records: 'id, projectId, sourceRunId, doi, pmid, duplicateGroupId',
      duplicateGroups: 'id, projectId',
      decisions: 'id, projectId, recordId, [recordId+stage]',
      studies: 'id, projectId',
      checklist: '[projectId+itemId], projectId',
    });
  }

  /** Child tables in dependency-free order (all keyed by projectId). */
  get childTables() {
    return [
      this.sources,
      this.sourceRuns,
      this.records,
      this.duplicateGroups,
      this.decisions,
      this.studies,
      this.checklist,
    ] as const;
  }
}

export const db = new FacetReviewDB();
