/**
 * Facet Review data model (see docs/PRD.md, section 4).
 * Every entity carries `projectId` so that export, import and cascading
 * deletion work via a single index.
 */

export type UUID = string;
/** ISO 8601 timestamp, e.g. 2026-09-30T12:00:00.000Z */
export type ISODate = string;

/** Version of the project exchange format (JSON export). Independent of the Dexie DB version. */
export const CURRENT_SCHEMA_VERSION = 1;

export type QuestionFramework = 'PICO' | 'PICo' | 'SPIDER' | 'free';
export type ReviewType = 'new' | 'update';

export interface Reviewer {
  id: UUID;
  name: string;
}

export interface ExclusionReason {
  id: UUID;
  label: string;
  order: number;
}

export interface Project {
  id: UUID;
  schemaVersion: number;
  title: string;
  question: {
    /** The research question itself; framework fields structure it optionally. */
    text: string;
    framework: QuestionFramework;
    fields: Record<string, string>;
  };
  reviewType: ReviewType;
  eligibility: { inclusion: string[]; exclusion: string[] };
  exclusionReasons: ExclusionReason[];
  registration: { registry: string; id: string; url: string; protocolUrl: string };
  /** `language` is the language of the review itself (e.g. the thesis), not the UI language. */
  metadata: { author: string; institution: string; language: string };
  /** V1: exactly one reviewer, kept in sync with `metadata.author`. */
  reviewers: Reviewer[];
  searchMeta: { filters?: string; priorWork?: string; updates?: string; peerReview?: string };
  flowOverrides?: { variant?: FlowVariant; previousStudies?: number; previousReports?: number };
  backup: { lastExportedAt?: ISODate; changesSinceExport: number };
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type SourceType =
  'database' | 'register' | 'website' | 'search_engine' | 'citation_search' | 'contact' | 'other';

export interface Source {
  id: UUID;
  projectId: UUID;
  type: SourceType;
  name: string;
  platform?: string;
  url?: string;
}

export interface SourceRun {
  id: UUID;
  projectId: UUID;
  sourceId: UUID;
  date: ISODate;
  searchString: string;
  limits?: string;
  reportedHits?: number;
  tool?: string;
  notes?: string;
}

/** Minimal CSL-JSON item; refined in milestone 3. */
export interface CslItem {
  type?: string;
  title?: string;
  [key: string]: unknown;
}

/** Not `Record` – that name collides with the TypeScript utility type. */
export interface BibRecord {
  id: UUID;
  projectId: UUID;
  sourceRunId: UUID;
  csl: CslItem;
  raw: string;
  doi?: string;
  pmid?: string;
  removedBeforeScreening?: { by: 'automation' | 'other'; reason: string };
  duplicateGroupId?: UUID;
  studyId?: UUID;
}

export interface DuplicateGroup {
  id: UUID;
  projectId: UUID;
  primaryRecordId: UUID;
  memberIds: UUID[];
  rule: 'doi' | 'pmid' | 'title-fuzzy' | 'manual';
  score?: number;
  confirmedAt?: ISODate;
}

/** Append-only audit trail; the current status is the latest decision. */
export interface Decision {
  id: UUID;
  projectId: UUID;
  recordId: UUID;
  reviewerId: UUID;
  stage: 'title_abstract' | 'full_text';
  value: 'include' | 'exclude' | 'maybe' | 'not_retrieved';
  reasonId?: UUID;
  note?: string;
  timestamp: ISODate;
}

export interface Study {
  id: UUID;
  projectId: UUID;
  label: string;
}

export interface ChecklistEntry {
  projectId: UUID;
  itemId: string;
  status: 'open' | 'done' | 'na';
  location?: string;
  note?: string;
}

export type FlowVariant = 'new_db' | 'new_db_other' | 'update_db' | 'update_db_other';

/** Everything that belongs to one project – the unit of export, import and deletion. */
export interface ProjectBundle {
  project: Project;
  sources: Source[];
  sourceRuns: SourceRun[];
  records: BibRecord[];
  duplicateGroups: DuplicateGroup[];
  decisions: Decision[];
  studies: Study[];
  checklist: ChecklistEntry[];
}

/** Injected side effects keep domain functions pure and deterministic in tests. */
export interface Clock {
  now: () => ISODate;
}
export interface IdSource {
  newId: () => UUID;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E[] };
