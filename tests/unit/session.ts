import { deduplicate } from '../../src/domain/dedup/dedup';
import { assignGroupIds } from '../../src/domain/dedup/groupIds';
import { createProject } from '../../src/domain/project/createProject';
import { createDecision, undoLast, type DecisionInput } from '../../src/domain/screening/decide';
import { evaluateUnits } from '../../src/domain/screening/stages';
import { orderRecords, runColumns, screeningUnits } from '../../src/domain/screening/units';
import type {
  BibRecord,
  Decision,
  DedupDecision,
  DuplicateGroup,
  ImportBatch,
  ImportFormat,
  Project,
  ProjectBundle,
  ScreeningStage,
  Source,
  SourceRun,
  SourceType,
  Study,
} from '../../src/domain/types';
import { labelOf, parseFixture } from './fixtures';

/**
 * A project played through on the fixtures: sources and runs, imports,
 * dedup and screening decisions. Records are named by their case label
 * (tests/fixtures/README.md); every action gets a later timestamp.
 */
export class Session {
  project: Project;
  sources: Source[] = [];
  runs: SourceRun[] = [];
  batches: ImportBatch[] = [];
  records: BibRecord[] = [];
  dedup: DedupDecision[] = [];
  decisions: Decision[] = [];
  groups: DuplicateGroup[] = [];
  studies: Study[] = [];
  private tick = 0;
  private ids = 0;

  constructor(reasonLabels: readonly string[] = []) {
    this.project = createProject(
      { title: 'Session', reviewType: 'new', author: 'Ada', language: 'de' },
      { newId: () => `p-${++this.ids}`, now: this.now, defaultReasonLabels: reasonLabels },
    );
  }

  now = () => {
    const t = ++this.tick;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    return `2026-10-01T10:${mm}:${ss}.000Z`;
  };

  get reviewerId() {
    return this.project.reviewers[0]!.id;
  }

  reasonId(label: string) {
    return this.project.exclusionReasons.find((r) => r.label === label)!.id;
  }

  /** A source with one search run; returns the run id. */
  addSource(name: string, type: SourceType = 'database') {
    const sourceId = `src-${++this.ids}`;
    const runId = `run-${this.ids}`;
    this.sources.push({ id: sourceId, projectId: this.project.id, type, name });
    this.runs.push({
      id: runId,
      projectId: this.project.id,
      sourceId,
      date: '2026-09-01',
      searchString: name,
    });
    return runId;
  }

  importFile(path: string, format: ImportFormat, runId = this.runs[0]?.id ?? this.addSource('Db')) {
    const batch: ImportBatch = {
      id: `batch-${++this.ids}`,
      projectId: this.project.id,
      sourceRunId: runId,
      fileName: path,
      format,
      importedAt: this.now(),
      recordCount: 0,
      warnings: [],
    };
    const parsed = parseFixture(path, format).records;
    batch.recordCount = parsed.length;
    this.batches.push(batch);
    for (const [index, record] of parsed.entries()) {
      this.records.push({
        id: labelOf(record.csl.abstract) ?? `${path}-${index}`,
        projectId: this.project.id,
        sourceRunId: runId,
        importBatchId: batch.id,
        sourceLine: record.line,
        csl: record.csl,
        raw: record.raw,
        ...(record.doi && { doi: record.doi }),
        ...(record.pmid && { pmid: record.pmid }),
      });
    }
    this.recompute();
  }

  dedupDecision(value: DedupDecision['value'], ...recordIds: string[]) {
    this.dedup.push({
      id: `dd-${++this.ids}`,
      projectId: this.project.id,
      recordIds,
      value,
      reviewerId: this.reviewerId,
      timestamp: this.now(),
    });
    this.recompute();
  }

  private recompute() {
    const result = deduplicate(this.records, this.dedup);
    this.groups = assignGroupIds(
      this.project.id,
      result.groups,
      this.groups,
      () => `g-${++this.ids}`,
    );
  }

  get evaluated() {
    const ordered = orderRecords(this.records, this.batches);
    const units = screeningUnits(ordered, this.groups, runColumns(this.sources, this.runs));
    return evaluateUnits(units, this.decisions, this.reviewerId, this.project.screening);
  }

  /** The current unit containing a record. */
  unitOf(recordId: string) {
    return this.evaluated.find((s) => s.unit.memberIds.includes(recordId))!;
  }

  private context() {
    return {
      projectId: this.project.id,
      reviewerId: this.reviewerId,
      newId: () => `d-${++this.ids}`,
      now: this.now,
    };
  }

  decide(recordId: string, input: DecisionInput) {
    const result = createDecision(this.unitOf(recordId).unit, input, this.context());
    if (!result.ok) throw new Error(result.errors.join());
    this.decisions.push(result.value);
    return result.value;
  }

  /** "Z" in the given stage. */
  undo(stage: ScreeningStage) {
    const plan = undoLast(this.decisions, stage, this.reviewerId);
    if (!plan) throw new Error('nothing to undo');
    const result = createDecision(plan.unit, plan.input, this.context());
    if (!result.ok) throw new Error(result.errors.join());
    this.decisions.push(result.value);
  }

  addStudy(label: string) {
    const study = { id: `study-${++this.ids}`, projectId: this.project.id, label };
    this.studies.push(study);
    return study.id;
  }

  bundle(): Omit<ProjectBundle, 'dedupDecisions' | 'checklist'> {
    return {
      project: this.project,
      sources: this.sources,
      sourceRuns: this.runs,
      importBatches: this.batches,
      records: this.records,
      duplicateGroups: this.groups,
      decisions: this.decisions,
      studies: this.studies,
    };
  }
}
