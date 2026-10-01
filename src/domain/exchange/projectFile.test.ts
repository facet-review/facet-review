import { describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../testing';
import { CURRENT_SCHEMA_VERSION } from '../types';
import { PROJECT_FILE_FORMAT, parseProjectFile, serializeProjectFile } from './projectFile';

const meta = { exportedAt: '2026-09-30T12:00:00.000Z', appVersion: '0.1.0' };

function roundTrip(bundle = makeLinkedBundle()) {
  return parseProjectFile(JSON.stringify(serializeProjectFile(bundle, meta)));
}

/** Loosely typed on purpose: these tests corrupt the file to exercise validation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CorruptibleFile = any;

function corruptibleFile(): CorruptibleFile {
  return structuredClone(serializeProjectFile(makeLinkedBundle(), meta));
}

function errorsOf(text: string) {
  const result = parseProjectFile(text);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
}

describe('serializeProjectFile', () => {
  it('wraps the bundle in a versioned envelope', () => {
    const file = serializeProjectFile(makeLinkedBundle(), meta);
    expect(file.format).toBe(PROJECT_FILE_FORMAT);
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(file.exportedAt).toBe(meta.exportedAt);
    expect(file.app).toEqual({ name: 'Facet Review', version: '0.1.0' });
  });
});

describe('parseProjectFile', () => {
  it('round-trips a complete bundle without loss', () => {
    expect(roundTrip()).toEqual({ ok: true, value: makeLinkedBundle() });
  });

  it('rejects invalid JSON', () => {
    expect(errorsOf('{ nope')).toEqual([{ code: 'invalidJson' }]);
  });

  it('rejects non-objects and foreign formats', () => {
    expect(errorsOf('[]')).toEqual([{ code: 'notAnObject' }]);
    expect(errorsOf('{"format":"something-else","schemaVersion":1}')).toEqual([
      { code: 'wrongFormat' },
    ]);
  });

  it('rejects missing or malformed schema versions', () => {
    const file = (v: unknown) => JSON.stringify({ format: PROJECT_FILE_FORMAT, schemaVersion: v });
    expect(errorsOf(JSON.stringify({ format: PROJECT_FILE_FORMAT }))).toEqual([
      { code: 'invalidSchemaVersion' },
    ]);
    expect(errorsOf(file('1'))).toEqual([{ code: 'invalidSchemaVersion' }]);
    expect(errorsOf(file(0))).toEqual([{ code: 'invalidSchemaVersion' }]);
    expect(errorsOf(file(1.5))).toEqual([{ code: 'invalidSchemaVersion' }]);
  });

  it('rejects files from a newer app version', () => {
    const text = JSON.stringify({ format: PROJECT_FILE_FORMAT, schemaVersion: 99 });
    expect(errorsOf(text)).toEqual([
      { code: 'unsupportedFutureVersion', detail: String(CURRENT_SCHEMA_VERSION) },
    ]);
  });

  it('reports every invalid field with its path', () => {
    const file = corruptibleFile();
    file.project.title = 42;
    file.project.reviewType = 'sometimes';
    file.project.eligibility.inclusion = ['ok', 3];
    file.project.exclusionReasons[0].order = 'first';
    delete file.project.metadata;
    file.records = 'none';
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'project.title' },
      { code: 'invalidField', path: 'project.reviewType' },
      { code: 'invalidField', path: 'project.eligibility.inclusion[1]' },
      { code: 'invalidField', path: 'project.exclusionReasons[0].order' },
      { code: 'invalidField', path: 'project.metadata' },
      { code: 'invalidField', path: 'records' },
    ]);
  });

  it('validates nested structures of the project', () => {
    const file = corruptibleFile();
    file.project.question.fields = { population: 5 };
    file.project.eligibility.exclusion = 'none';
    file.project.flowOverrides = { variant: 'sideways' };
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'project.question.fields.population' },
      { code: 'invalidField', path: 'project.eligibility.exclusion' },
      { code: 'invalidField', path: 'project.flowOverrides.variant' },
    ]);
  });

  it('reports missing containers of nested structures', () => {
    const file = corruptibleFile();
    file.project.question.fields = null;
    delete file.project.eligibility;
    file.project.reviewers = {};
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'project.question.fields' },
      { code: 'invalidField', path: 'project.eligibility' },
      { code: 'invalidField', path: 'project.reviewers' },
    ]);
  });

  it('requires the project object itself', () => {
    const file = corruptibleFile();
    delete file.project;
    expect(errorsOf(JSON.stringify(file))).toEqual([{ code: 'invalidField', path: 'project' }]);
  });

  it('requires child entities to have ids and belong to the project', () => {
    const file = corruptibleFile();
    file.sources[0].projectId = 'other-project';
    file.decisions[0].id = 7;
    file.studies = [null];
    file.checklist[0].itemId = undefined;
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'sources[0].projectId' },
      { code: 'invalidField', path: 'decisions[0].id' },
      { code: 'invalidField', path: 'studies[0]' },
      { code: 'invalidField', path: 'checklist[0].itemId' },
    ]);
  });

  it('validates sources and search runs field by field', () => {
    const file = corruptibleFile();
    file.sources[0].type = 'library';
    file.sources[0].databases = ['CINAHL', 7];
    file.sourceRuns[0].date = '29.09.2026';
    file.sourceRuns[0].dateTo = '2026-02-30';
    file.sourceRuns[0].reportedHits = -2;
    file.sourceRuns[0].method = 'guess';
    file.sourceRuns[0].searchString = null;
    file.sourceRuns[0].noLimits = 'yes';
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'sources[0].type' },
      { code: 'invalidField', path: 'sources[0].databases[1]' },
      { code: 'invalidField', path: 'sourceRuns[0].date' },
      { code: 'invalidField', path: 'sourceRuns[0].dateTo' },
      { code: 'invalidField', path: 'sourceRuns[0].searchString' },
      { code: 'invalidField', path: 'sourceRuns[0].noLimits' },
      { code: 'invalidField', path: 'sourceRuns[0].reportedHits' },
      { code: 'invalidField', path: 'sourceRuns[0].method' },
    ]);
  });

  it('rejects search runs that point to a missing source', () => {
    const file = corruptibleFile();
    file.sourceRuns[0].sourceId = 'src-missing';
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'sourceRuns[0].sourceId' },
    ]);
  });

  it('round-trips all type-specific run fields', () => {
    const bundle = makeLinkedBundle();
    bundle.sources[0] = {
      ...bundle.sources[0]!,
      platform: 'EBSCOhost',
      databases: ['CINAHL', 'ERIC'],
    };
    bundle.sourceRuns[0] = {
      ...bundle.sourceRuns[0]!,
      dateTo: '2026-09-30',
      limits: 'English',
      tool: 'Citationchaser',
      method: 'browse',
      recordsChecked: 200,
      citationDirection: 'both',
      seedDocuments: 'Doe 2020',
      description: 'd',
      notes: 'n',
    };
    expect(roundTrip(bundle)).toEqual({ ok: true, value: bundle });
  });

  it('migrates version 1 files (milestones 1–2) by adding the new collections', () => {
    const file = corruptibleFile();
    file.schemaVersion = 1;
    delete file.importBatches;
    delete file.dedupDecisions;
    file.records = [];
    file.duplicateGroups = [];
    file.decisions = [];
    file.studies = [];
    const result = parseProjectFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.importBatches).toEqual([]);
      expect(result.value.dedupDecisions).toEqual([]);
      expect(result.value.sources).toHaveLength(1);
    }
  });

  it('validates import batches, records and dedup data', () => {
    const file = corruptibleFile();
    file.importBatches[0].format = 'docx';
    file.importBatches[0].warnings = [{ line: 'x' }];
    file.records[0].csl = 'not an object';
    file.records[1].sourceLine = -1;
    file.duplicateGroups[0].rule = 'vibes';
    file.dedupDecisions[0].value = 'maybe';
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'importBatches[0].format' },
      { code: 'invalidField', path: 'importBatches[0].warnings[0]' },
      { code: 'invalidField', path: 'records[0].csl' },
      { code: 'invalidField', path: 'records[1].sourceLine' },
      { code: 'invalidField', path: 'duplicateGroups[0].rule' },
      { code: 'invalidField', path: 'dedupDecisions[0].value' },
    ]);
  });

  it('rejects broken references along the chain search → batch → record → group', () => {
    const file = corruptibleFile();
    file.importBatches[0].sourceRunId = 'run-missing';
    file.records[0].importBatchId = 'batch-missing';
    file.records[1].sourceRunId = 'run-missing';
    file.duplicateGroups[0].memberIds = ['rec-1', 'rec-missing'];
    file.dedupDecisions[0].recordIds = ['rec-missing'];
    expect(errorsOf(JSON.stringify(file))).toEqual([
      { code: 'invalidField', path: 'importBatches[0].sourceRunId' },
      { code: 'invalidField', path: 'records[0].importBatchId' },
      { code: 'invalidField', path: 'records[1].sourceRunId' },
      { code: 'invalidField', path: 'duplicateGroups[0].memberIds[1]' },
      { code: 'invalidField', path: 'dedupDecisions[0].recordIds[0]' },
    ]);
  });

  it('accepts files without optional project fields', () => {
    const bundle = makeLinkedBundle();
    bundle.project.flowOverrides = { variant: 'new_db', previousStudies: 3 };
    bundle.project.backup = { changesSinceExport: 2, lastExportedAt: '2026-09-01T00:00:00.000Z' };
    expect(roundTrip(bundle)).toEqual({ ok: true, value: bundle });
  });
});
