import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  BibRecord,
  ChecklistEntry,
  Decision,
  DedupDecision,
  DuplicateGroup,
  ImportBatch,
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
  declare importBatches: EntityTable<ImportBatch, 'id'>;
  declare records: EntityTable<BibRecord, 'id'>;
  declare duplicateGroups: EntityTable<DuplicateGroup, 'id'>;
  declare dedupDecisions: EntityTable<DedupDecision, 'id'>;
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
    // Milestone 3: import batches and dedup decisions; records indexed by batch.
    // No upgrade function needed: version 1 never stored records.
    this.version(2).stores({
      importBatches: 'id, projectId, sourceRunId',
      records: 'id, projectId, sourceRunId, importBatchId, doi, pmid, duplicateGroupId',
      dedupDecisions: 'id, projectId',
    });
    // Milestone 4: decisions refer to all records of a screening unit (multi-entry
    // index); same transformation as PROJECT_MIGRATIONS[2] for the exchange format.
    this.version(3)
      .stores({ decisions: 'id, projectId, *recordIds' })
      .upgrade(async (tx) => {
        await tx
          .table('projects')
          .toCollection()
          .modify((project: Record<string, unknown>) => {
            project.screening ??= {
              maybeToFullText: false,
              highlights: { include: [], exclude: [] },
            };
          });
        await tx
          .table('records')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            delete record.studyId;
            delete record.removedBeforeScreening;
          });
        await tx
          .table('decisions')
          .toCollection()
          .modify((decision: Record<string, unknown>) => {
            if (typeof decision.recordId !== 'string') return;
            decision.recordIds = [decision.recordId];
            decision.shownRecordId = decision.recordId;
            delete decision.recordId;
          });
      });
  }

  /** Child tables in dependency-free order (all keyed by projectId). */
  get childTables() {
    return [
      this.sources,
      this.sourceRuns,
      this.importBatches,
      this.records,
      this.duplicateGroups,
      this.dedupDecisions,
      this.decisions,
      this.studies,
      this.checklist,
    ] as const;
  }
}

export const db = new FacetReviewDB();
