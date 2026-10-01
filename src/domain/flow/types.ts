import type { FlowVariant, SourceType, UUID } from '../types';

/** A number in the flow diagram and the records behind it (units by their primary record). */
export interface Count {
  n: number;
  recordIds: UUID[];
}

export interface SourceCount extends Count {
  sourceId: UUID;
  /** Display name, e.g. "EBSCOhost (CINAHL, ERIC)". */
  label: string;
  type: SourceType;
}

export interface ReasonCount extends Count {
  reasonId: UUID;
  label: string;
}

/** Right column of the template: "Records identified from: Websites / Organisations / …". */
export type OtherMethod = 'websites' | 'organisations' | 'citations' | 'other';

export interface MethodCount extends Count {
  method: OtherMethod;
}

/** Full-text part, the same in both columns. */
export interface Retrieval {
  sought: Count;
  notRetrieved: Count;
  assessed: Count;
  /** All reasons of the project in their order, including n = 0. */
  reportsExcluded: ReasonCount[];
  reportsExcludedTotal: Count;
  /** Included reports of this column. */
  included: Count;
  /** Not decided in full-text screening (open, conflict, split-off). */
  open: Count;
}

export interface DatabaseColumn extends Retrieval {
  databases: SourceCount[];
  registers: SourceCount[];
  identified: Count;
  duplicates: Count;
  removedAutomation: Count;
  removedOther: Count;
  screened: Count;
  excluded: Count;
  /** Not decided in title/abstract screening (incl. maybes not taken to full text). */
  openScreening: Count;
}

export interface OtherColumn extends Retrieval {
  methods: MethodCount[];
  sources: SourceCount[];
  identified: Count;
  /** Records of other methods merged into units of the left column (reported there). */
  inDatabaseUnits: Count;
  /** Duplicates among records found only by other methods (no box in the template). */
  duplicatesWithin: Count;
}

export type CheckId = 'identification' | 'screening' | 'retrieval' | 'eligibility';

/**
 * Consistency check of PRD §5: `total = Σ parts (+ open)`.
 * ok – holds without open units; incomplete – holds counting open units;
 * error – does not hold (a counting bug, never expected).
 */
export interface FlowCheck {
  id: CheckId;
  column: 'databases' | 'other';
  total: number;
  parts: number[];
  open: number;
  status: 'ok' | 'incomplete' | 'error';
}

export interface StudyGroupCount extends Count {
  studyId?: UUID;
  label?: string;
}

export interface FlowCounts {
  variant: FlowVariant;
  /** Detected from project and sources; `variant` differs if overridden. */
  detectedVariant: FlowVariant;
  databases: DatabaseColumn;
  other: OtherColumn;
  /** Reports of included studies (both columns). */
  reports: Count;
  /** Studies included in review; reports without assignment are studies of their own. */
  studies: Count & { groups: StudyGroupCount[] };
  /** Update reviews: entered manually (no data in this project). */
  previous?: { studies?: number; reports?: number };
  checks: FlowCheck[];
}
