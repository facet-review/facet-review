import { createProject } from './project/createProject';
import type { ISODate, ProjectBundle, UUID } from './types';

/** Deterministic id generator for tests: id-1, id-2, … */
export function sequentialIds(prefix = 'id'): () => UUID {
  let counter = 0;
  return () => `${prefix}-${++counter}`;
}

export function fixedClock(iso: ISODate): () => ISODate {
  return () => iso;
}

/**
 * A small but fully linked bundle: every reference type (source → run → record →
 * duplicate group / decision / study, reviewer, exclusion reason, undo) is present.
 */
export function makeLinkedBundle(): ProjectBundle {
  const project = createProject(
    { title: 'Tutoring and grades', reviewType: 'new', author: 'Ada', language: 'en' },
    {
      newId: sequentialIds('p'),
      now: fixedClock('2026-09-30T10:00:00.000Z'),
      defaultReasonLabels: ['Wrong population'],
    },
  );
  const reviewerId = project.reviewers[0]!.id;
  const reasonId = project.exclusionReasons[0]!.id;
  const projectId = project.id;
  return {
    project,
    sources: [{ id: 'src-1', projectId, type: 'database', name: 'Scopus' }],
    sourceRuns: [
      {
        id: 'run-1',
        projectId,
        sourceId: 'src-1',
        date: '2026-09-29',
        searchString: 'tutoring AND grades',
        reportedHits: 2,
      },
    ],
    importBatches: [
      {
        id: 'batch-1',
        projectId,
        sourceRunId: 'run-1',
        fileName: 'scopus.ris',
        format: 'ris',
        importedAt: '2026-09-30T10:30:00.000Z',
        recordCount: 2,
        warnings: [],
      },
    ],
    records: [
      {
        id: 'rec-1',
        projectId,
        sourceRunId: 'run-1',
        importBatchId: 'batch-1',
        sourceLine: 1,
        csl: { type: 'article-journal', title: 'A' },
        raw: 'TY  - JOUR',
        doi: '10.1/a',
        duplicateGroupId: 'grp-1',
      },
      {
        id: 'rec-2',
        projectId,
        sourceRunId: 'run-1',
        importBatchId: 'batch-1',
        csl: { title: 'A (dup)' },
        raw: 'TY  - JOUR',
        doi: '10.1/a',
        duplicateGroupId: 'grp-1',
      },
    ],
    duplicateGroups: [
      {
        id: 'grp-1',
        projectId,
        primaryRecordId: 'rec-1',
        memberIds: ['rec-1', 'rec-2'],
        rule: 'doi',
        links: [{ a: 'rec-1', b: 'rec-2', rule: 'doi' }],
      },
    ],
    dedupDecisions: [
      {
        id: 'dd-1',
        projectId,
        recordIds: ['rec-1', 'rec-2'],
        value: 'merge',
        reviewerId,
        timestamp: '2026-09-30T11:30:00.000Z',
      },
    ],
    decisions: [
      {
        id: 'dec-1',
        projectId,
        recordIds: ['rec-1', 'rec-2'],
        shownRecordId: 'rec-1',
        reviewerId,
        stage: 'full_text',
        value: 'exclude',
        reasonId,
        timestamp: '2026-09-30T11:00:00.000Z',
      },
      {
        id: 'dec-2',
        projectId,
        recordIds: ['rec-1', 'rec-2'],
        shownRecordId: 'rec-1',
        reviewerId,
        stage: 'full_text',
        value: 'include',
        studyId: 'study-1',
        undoOf: 'dec-1',
        timestamp: '2026-09-30T11:05:00.000Z',
      },
    ],
    studies: [{ id: 'study-1', projectId, label: 'Study A' }],
    checklist: [{ projectId, itemId: '16a', status: 'done', location: 'p. 12' }],
  };
}
