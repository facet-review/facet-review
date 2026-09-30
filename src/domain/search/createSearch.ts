import type { DateOnly, Source, SourceRun, SourceType, UUID } from '../types';
import { SOURCE_TYPE_CONFIG, type RunField } from './sourceTypes';

export function createSource(
  input: { projectId: UUID; type: SourceType; name: string },
  newId: () => UUID,
): Source {
  return { id: newId(), projectId: input.projectId, type: input.type, name: input.name.trim() };
}

export function createRun(
  input: { projectId: UUID; sourceId: UUID; date: DateOnly },
  newId: () => UUID,
): SourceRun {
  return {
    id: newId(),
    projectId: input.projectId,
    sourceId: input.sourceId,
    date: input.date,
    searchString: '',
  };
}

const OPTIONAL_RUN_FIELDS = [
  'dateTo',
  'limits',
  'reportedHits',
  'tool',
  'method',
  'recordsChecked',
  'citationDirection',
  'seedDocuments',
  'description',
  'notes',
] as const satisfies readonly RunField[];

/**
 * Keeps only the fields that apply to the source type and drops empty text,
 * so stored runs contain nothing hidden from the form. The search string is
 * stored verbatim (whitespace matters in line-numbered strategies).
 */
export function pruneRun(type: SourceType, run: SourceRun): SourceRun {
  const fields = SOURCE_TYPE_CONFIG[type].runFields;
  const pruned: SourceRun = {
    id: run.id,
    projectId: run.projectId,
    sourceId: run.sourceId,
    date: run.date,
    searchString: fields.includes('searchString') ? run.searchString : '',
  };
  for (const key of OPTIONAL_RUN_FIELDS) {
    const value = run[key];
    if (!fields.includes(key) || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    Object.assign(pruned, { [key]: value });
  }
  return pruned;
}

/** Form state: every editable field as a string (inputs never hold numbers). */
export type RunDraft = Pick<SourceRun, 'id' | 'projectId' | 'sourceId'> &
  Record<'date' | 'searchString' | (typeof OPTIONAL_RUN_FIELDS)[number], string>;

export function draftFromRun(run: SourceRun): RunDraft {
  const text = (value: string | number | undefined) => (value === undefined ? '' : String(value));
  return {
    id: run.id,
    projectId: run.projectId,
    sourceId: run.sourceId,
    date: run.date,
    searchString: run.searchString,
    ...(Object.fromEntries(OPTIONAL_RUN_FIELDS.map((key) => [key, text(run[key])])) as Record<
      (typeof OPTIONAL_RUN_FIELDS)[number],
      string
    >),
  };
}

/** Empty inputs become absent fields; non-numeric counts become NaN and fail validation. */
export function runFromDraft(draft: RunDraft): SourceRun {
  const count = (value: string) => (value.trim() === '' ? undefined : Number(value));
  const run: SourceRun = {
    id: draft.id,
    projectId: draft.projectId,
    sourceId: draft.sourceId,
    date: draft.date,
    searchString: draft.searchString,
  };
  const values: Partial<SourceRun> = {
    dateTo: draft.dateTo,
    limits: draft.limits,
    reportedHits: count(draft.reportedHits),
    tool: draft.tool,
    method: draft.method as SourceRun['method'],
    recordsChecked: count(draft.recordsChecked),
    citationDirection: draft.citationDirection as SourceRun['citationDirection'],
    seedDocuments: draft.seedDocuments,
    description: draft.description,
    notes: draft.notes,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '') continue;
    Object.assign(run, { [key]: value });
  }
  return run;
}

/** Keeps only the source fields of its type, trims text, drops empty entries. */
export function pruneSource(source: Source): Source {
  const fields = SOURCE_TYPE_CONFIG[source.type].sourceFields;
  const pruned: Source = {
    id: source.id,
    projectId: source.projectId,
    type: source.type,
    name: source.name.trim(),
  };
  for (const key of ['platform', 'url'] as const) {
    const value = source[key]?.trim();
    if (fields.includes(key) && value) pruned[key] = value;
  }
  const databases = (source.databases ?? []).map((name) => name.trim()).filter(Boolean);
  if (fields.includes('databases') && databases.length > 0) pruned.databases = databases;
  return pruned;
}
