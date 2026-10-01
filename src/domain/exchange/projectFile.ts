import { SOURCE_TYPES } from '../search/sourceTypes';
import { isDateOnly } from '../util/dates';
import { CURRENT_SCHEMA_VERSION, type ISODate, type ProjectBundle, type Result } from '../types';
import type { ImportIssue } from './issues';
import { PROJECT_MIGRATIONS, runMigrations, type VersionedFile } from './migrations';

export const PROJECT_FILE_FORMAT = 'facet-review-project';

/** The JSON exchange format: a versioned envelope around a ProjectBundle. */
export interface ProjectFile extends ProjectBundle {
  format: typeof PROJECT_FILE_FORMAT;
  schemaVersion: number;
  exportedAt: ISODate;
  app: { name: string; version: string };
}

export function serializeProjectFile(
  bundle: ProjectBundle,
  meta: { exportedAt: ISODate; appVersion: string },
): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: meta.exportedAt,
    app: { name: 'Facet Review', version: meta.appVersion },
    ...bundle,
  };
}

const COLLECTIONS = [
  'sources',
  'sourceRuns',
  'importBatches',
  'records',
  'duplicateGroups',
  'dedupDecisions',
  'decisions',
  'studies',
  'checklist',
] as const;

/** Parses and validates a project file. Never throws; problems are returned with paths. */
export function parseProjectFile(text: string): Result<ProjectBundle, ImportIssue> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail({ code: 'invalidJson' });
  }
  if (!isObject(data)) return fail({ code: 'notAnObject' });
  if (data.format !== PROJECT_FILE_FORMAT) return fail({ code: 'wrongFormat' });

  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail({ code: 'invalidSchemaVersion' });
  }
  const migrated = runMigrations(data as VersionedFile, PROJECT_MIGRATIONS, CURRENT_SCHEMA_VERSION);
  if (!migrated.ok) return migrated;

  const file = migrated.value;
  const issues: ImportIssue[] = [];
  const invalid = (path: string) => issues.push({ code: 'invalidField', path });

  const projectId = validateProject(file.project, invalid);
  // A collection that is itself broken is reported once; references into it are not checked.
  const idsOf = (key: (typeof COLLECTIONS)[number]) =>
    Array.isArray(file[key])
      ? new Set((file[key] as unknown[]).filter(isObject).map((entity) => entity.id))
      : undefined;
  const context: Context = {
    projectId,
    sourceIds: idsOf('sources'),
    runIds: idsOf('sourceRuns'),
    batchIds: idsOf('importBatches'),
    recordIds: idsOf('records'),
  };
  for (const key of COLLECTIONS) {
    validateCollection(file[key], key, context, invalid);
  }
  if (issues.length > 0) return { ok: false, errors: issues };

  const bundle = Object.fromEntries(
    ['project', ...COLLECTIONS].map((key) => [key, file[key]]),
  ) as unknown as ProjectBundle;
  return { ok: true, value: bundle };
}

function fail(issue: ImportIssue): Result<never, ImportIssue> {
  return { ok: false, errors: [issue] };
}

// --- validation helpers -------------------------------------------------------

type Report = (path: string) => void;
type Check = (value: unknown) => boolean;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString: Check = (v) => typeof v === 'string';
const isBoolean: Check = (v) => typeof v === 'boolean';
const isNumber: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const optional =
  (check: Check): Check =>
  (v) =>
    v === undefined || check(v);
const oneOf =
  (...values: readonly string[]): Check =>
  (v) =>
    typeof v === 'string' && values.includes(v);

function checkFields(
  value: unknown,
  path: string,
  fields: Record<string, Check>,
  report: Report,
): value is Record<string, unknown> {
  if (!isObject(value)) {
    report(path);
    return false;
  }
  for (const [key, check] of Object.entries(fields)) {
    if (!check(value[key])) report(`${path}.${key}`);
  }
  return true;
}

function checkArray(value: unknown, path: string, item: Check, report: Report) {
  if (!Array.isArray(value)) {
    report(path);
    return;
  }
  value.forEach((entry, index) => {
    if (!item(entry)) report(`${path}[${index}]`);
  });
}

/** Validates the project; returns its id when usable for child checks. */
function validateProject(value: unknown, report: Report): string | undefined {
  const ok = checkFields(
    value,
    'project',
    {
      id: isString,
      schemaVersion: isNumber,
      title: isString,
      reviewType: oneOf('new', 'update'),
      createdAt: isString,
      updatedAt: isString,
    },
    report,
  );
  if (!ok) return undefined;
  const project = value;

  checkFields(
    project.question,
    'project.question',
    { text: isString, framework: oneOf('PICO', 'PICo', 'SPIDER', 'free') },
    report,
  );
  if (isObject(project.question)) {
    const fields = project.question.fields;
    if (!isObject(fields)) report('project.question.fields');
    else
      for (const [key, v] of Object.entries(fields))
        if (!isString(v)) report(`project.question.fields.${key}`);
  }

  if (isObject(project.eligibility)) {
    checkArray(project.eligibility.inclusion, 'project.eligibility.inclusion', isString, report);
    checkArray(project.eligibility.exclusion, 'project.eligibility.exclusion', isString, report);
  } else report('project.eligibility');

  checkList(project.exclusionReasons, 'project.exclusionReasons', report, {
    id: isString,
    label: isString,
    order: isNumber,
  });
  checkFields(
    project.registration,
    'project.registration',
    { registry: isString, id: isString, url: isString, protocolUrl: isString },
    report,
  );
  checkFields(
    project.metadata,
    'project.metadata',
    { author: isString, institution: isString, language: isString },
    report,
  );
  checkList(project.reviewers, 'project.reviewers', report, { id: isString, name: isString });
  checkFields(
    project.searchMeta,
    'project.searchMeta',
    {
      filters: optional(isString),
      priorWork: optional(isString),
      updates: optional(isString),
      peerReview: optional(isString),
    },
    report,
  );
  if (project.flowOverrides !== undefined) {
    checkFields(
      project.flowOverrides,
      'project.flowOverrides',
      {
        variant: optional(oneOf('new_db', 'new_db_other', 'update_db', 'update_db_other')),
        previousStudies: optional(isNumber),
        previousReports: optional(isNumber),
      },
      report,
    );
  }
  checkFields(
    project.backup,
    'project.backup',
    { lastExportedAt: optional(isString), changesSinceExport: isNumber },
    report,
  );

  return isString(project.id) ? (project.id as string) : undefined;
}

function checkList(value: unknown, path: string, report: Report, fields: Record<string, Check>) {
  if (!Array.isArray(value)) {
    report(path);
    return;
  }
  value.forEach((entry, index) => checkFields(entry, `${path}[${index}]`, fields, report));
}

const isCount: Check = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isDate: Check = (v) => typeof v === 'string' && isDateOnly(v);

interface Context {
  projectId: string | undefined;
  sourceIds: Set<unknown> | undefined;
  runIds: Set<unknown> | undefined;
  batchIds: Set<unknown> | undefined;
  recordIds: Set<unknown> | undefined;
}

/** Reference into another collection; only the type is checked if that collection is broken. */
const refersTo =
  (ids: Set<unknown> | undefined): Check =>
  (v) =>
    isString(v) && (ids === undefined || ids.has(v));

/** Entity-specific fields; entities not listed yet are refined in their milestone. */
function entityFields(key: (typeof COLLECTIONS)[number], context: Context): Record<string, Check> {
  switch (key) {
    case 'sources':
      return {
        type: oneOf(...SOURCE_TYPES),
        name: isString,
        platform: optional(isString),
        url: optional(isString),
      };
    case 'sourceRuns':
      return {
        sourceId: refersTo(context.sourceIds),
        date: isDate,
        dateTo: optional(isDate),
        searchString: isString,
        limits: optional(isString),
        noLimits: optional(isBoolean),
        reportedHits: optional(isCount),
        tool: optional(isString),
        method: optional(oneOf('search', 'browse')),
        recordsChecked: optional(isCount),
        citationDirection: optional(oneOf('backward', 'forward', 'both')),
        seedDocuments: optional(isString),
        description: optional(isString),
        notes: optional(isString),
        importNote: optional(isString),
      };
    case 'importBatches':
      return {
        sourceRunId: refersTo(context.runIds),
        fileName: isString,
        format: oneOf('ris', 'nbib', 'bibtex', 'csv'),
        importedAt: isString,
        recordCount: isCount,
      };
    case 'records':
      return {
        sourceRunId: refersTo(context.runIds),
        importBatchId: refersTo(context.batchIds),
        sourceLine: optional(isCount),
        csl: isObject,
        raw: isString,
        doi: optional(isString),
        pmid: optional(isString),
        duplicateGroupId: optional(isString),
        studyId: optional(isString),
        removedBeforeScreening: optional(isObject),
      };
    case 'duplicateGroups':
      return {
        primaryRecordId: refersTo(context.recordIds),
        rule: oneOf('doi', 'pmid', 'title-fuzzy', 'manual'),
        score: optional(isNumber),
        confirmedAt: optional(isString),
      };
    case 'dedupDecisions':
      return {
        value: oneOf('merge', 'separate', 'reset', 'primary'),
        reviewerId: isString,
        timestamp: isString,
      };
    default:
      return {};
  }
}

/** Arrays inside entities, checked element by element. */
function entityArrays(key: (typeof COLLECTIONS)[number], context: Context): Record<string, Check> {
  const isWarning: Check = (v) =>
    isObject(v) && isString(v.code) && optional(isCount)(v.line) && optional(isString)(v.detail);
  const isLink: Check = (v) =>
    isObject(v) &&
    isString(v.a) &&
    isString(v.b) &&
    oneOf('doi', 'pmid', 'title-fuzzy', 'manual')(v.rule) &&
    optional(isNumber)(v.score);
  switch (key) {
    case 'sources':
      return { databases: isString };
    case 'importBatches':
      return { warnings: isWarning };
    case 'duplicateGroups':
      return { memberIds: refersTo(context.recordIds), links: isLink };
    case 'dedupDecisions':
      return { recordIds: refersTo(context.recordIds) };
    default:
      return {};
  }
}

/** Arrays that may be absent on an entity (all others are required). */
const OPTIONAL_ARRAYS = new Set(['databases']);

/**
 * Child entities: identity (id, or itemId for the checklist), matching projectId,
 * entity-specific fields and references that must resolve within the file.
 */
function validateCollection(
  value: unknown,
  key: (typeof COLLECTIONS)[number],
  context: Context,
  report: Report,
) {
  const belongs: Check = (v) => context.projectId === undefined || v === context.projectId;
  const identity: Record<string, Check> =
    key === 'checklist' ? { itemId: isString } : { id: isString };
  if (!Array.isArray(value)) {
    report(key);
    return;
  }
  const arrays = entityArrays(key, context);
  value.forEach((entity, index) => {
    const path = `${key}[${index}]`;
    const ok = checkFields(
      entity,
      path,
      { ...identity, projectId: belongs, ...entityFields(key, context) },
      report,
    );
    if (!ok) return;
    for (const [field, item] of Object.entries(arrays)) {
      const array = entity[field];
      if (array === undefined && OPTIONAL_ARRAYS.has(field)) continue;
      checkArray(array, `${path}.${field}`, item, report);
    }
  });
}
