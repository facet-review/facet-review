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
  'records',
  'duplicateGroups',
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
  for (const key of COLLECTIONS) {
    validateCollection(file[key], key, projectId, invalid);
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

/**
 * Child entities: structure beyond identity is validated in the milestone that
 * introduces them. Here: object, id (itemId for checklist), matching projectId.
 */
function validateCollection(
  value: unknown,
  key: (typeof COLLECTIONS)[number],
  projectId: string | undefined,
  report: Report,
) {
  const belongs: Check = (v) => projectId === undefined || v === projectId;
  const identity: Record<string, Check> =
    key === 'checklist' ? { itemId: isString } : { id: isString };
  checkList(value, key, report, { ...identity, projectId: belongs });
}
