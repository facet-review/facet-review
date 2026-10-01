import { sortedReasons } from '../project/exclusionReasons';
import { flowColumn } from '../search/sourceTypes';
import { sourceLabel } from '../search/summary';
import { evaluateUnits, type UnitScreening } from '../screening/stages';
import { isIncludedReport, studyGroups } from '../screening/studies';
import { orderRecords, runColumns, screeningUnits } from '../screening/units';
import type { ProjectBundle, SourceType, UUID } from '../types';
import type {
  Count,
  DatabaseColumn,
  FlowCheck,
  FlowCounts,
  MethodCount,
  OtherColumn,
  OtherMethod,
  ReasonCount,
  Retrieval,
  SourceCount,
} from './types';
import { detectVariant } from './variant';

export type FlowInput = Pick<
  ProjectBundle,
  | 'project'
  | 'sources'
  | 'sourceRuns'
  | 'importBatches'
  | 'records'
  | 'duplicateGroups'
  | 'decisions'
  | 'studies'
>;

const count = (recordIds: UUID[]): Count => ({ n: recordIds.length, recordIds });
const primaries = (units: readonly UnitScreening[]) => count(units.map((s) => s.unit.primaryId));

const METHOD_OF: Partial<Record<SourceType, OtherMethod>> = {
  website: 'websites',
  contact: 'organisations',
  citation_search: 'citations',
  other: 'other',
};
const METHODS: readonly OtherMethod[] = ['websites', 'organisations', 'citations', 'other'];

/**
 * All numbers of the PRISMA 2020 flow diagram (PRD §5), derived from records,
 * duplicate groups and the screening status of the units (milestone 4).
 * Every number carries the records behind it.
 */
export function computeFlow(data: FlowInput): FlowCounts {
  const { project } = data;
  const columns = runColumns(data.sources, data.sourceRuns);
  const ordered = orderRecords(data.records, data.importBatches);
  const units = screeningUnits(ordered, data.duplicateGroups, columns);
  const reviewerId = project.reviewers[0]?.id ?? '';
  const evaluated = evaluateUnits(units, data.decisions, reviewerId, project.screening);
  const reasons = sortedReasons(project.exclusionReasons);

  const sourceOfRun = new Map(data.sourceRuns.map((run) => [run.id, run.sourceId]));
  const sourceById = new Map(data.sources.map((source) => [source.id, source]));
  const recordSource = new Map(
    data.records.map((record) => [record.id, sourceOfRun.get(record.sourceRunId)]),
  );
  const isLeftRecord = (id: UUID) => {
    const source = sourceById.get(recordSource.get(id) ?? '');
    return !source || flowColumn(source.type) === 'databases_registers';
  };

  const perSource = (types: readonly SourceType[]): SourceCount[] =>
    data.sources
      .filter((source) => types.includes(source.type))
      .map((source) => {
        const ids = data.records
          .filter((record) => recordSource.get(record.id) === source.id)
          .map((record) => record.id);
        return {
          sourceId: source.id,
          label: sourceLabel(source),
          type: source.type,
          ...count(ids),
        };
      })
      .filter(
        (source) => source.n > 0 || data.sourceRuns.some((r) => r.sourceId === source.sourceId),
      );

  const retrieval = (sought: UnitScreening[]): Retrieval => {
    const outcome = (value: string) =>
      sought.filter((s) => s.fullText.state === 'decided' && s.fullText.decision!.value === value);
    const notRetrieved = outcome('not_retrieved');
    const excluded = outcome('exclude');
    const reportsExcluded: ReasonCount[] = reasons.map((reason) => ({
      reasonId: reason.id,
      label: reason.label,
      ...primaries(excluded.filter((s) => s.fullText.decision!.reasonId === reason.id)),
    }));
    const notRetrievedSet = new Set(notRetrieved);
    return {
      sought: primaries(sought),
      notRetrieved: primaries(notRetrieved),
      assessed: primaries(sought.filter((s) => !notRetrievedSet.has(s))),
      reportsExcluded,
      reportsExcludedTotal: primaries(excluded),
      included: primaries(outcome('include')),
      open: primaries(sought.filter((s) => s.fullText.state !== 'decided')),
    };
  };

  // Left column: databases, registers, search engines.
  const left = evaluated.filter((s) => s.unit.column === 'databases_registers');
  const leftMembers = (s: UnitScreening) => s.unit.memberIds.filter(isLeftRecord);
  const duplicates = left.flatMap((s) => {
    const members = leftMembers(s);
    const keep = members.includes(s.unit.primaryId) ? s.unit.primaryId : members[0];
    return members.filter((id) => id !== keep);
  });
  const removedBy = (value: string) =>
    left.filter(
      (s) => s.removed && s.removal.state === 'decided' && s.removal.decision!.value === value,
    );
  const removedAutomation = removedBy('remove_automation');
  const removedConflict = left.filter((s) => s.removed && s.removal.state === 'conflict');
  const removedOther = [...removedBy('remove_other'), ...removedConflict];
  const screened = left.filter((s) => s.inTitleAbstract);
  const excluded = screened.filter(
    (s) => s.titleAbstract.state === 'decided' && s.titleAbstract.decision!.value === 'exclude',
  );
  const sought = screened.filter((s) => s.inFullText);
  const excludedSet = new Set(excluded);
  const soughtSet = new Set(sought);
  const openScreening = screened.filter((s) => !excludedSet.has(s) && !soughtSet.has(s));
  const databases = perSource(['database', 'search_engine']);
  const registers = perSource(['register']);
  const databaseColumn: DatabaseColumn = {
    databases,
    registers,
    identified: count([...databases, ...registers].flatMap((s) => s.recordIds)),
    duplicates: count(duplicates),
    removedAutomation: primaries(removedAutomation),
    removedOther: primaries(removedOther),
    screened: primaries(screened),
    excluded: primaries(excluded),
    openScreening: primaries(openScreening),
    ...retrieval(sought),
  };

  // Right column: other methods; only units found by other methods alone.
  const right = evaluated.filter((s) => s.unit.column === 'other_methods');
  const otherSources = perSource(['website', 'contact', 'citation_search', 'other']);
  const methods: MethodCount[] = METHODS.map((method) => ({
    method,
    ...count(otherSources.filter((s) => METHOD_OF[s.type] === method).flatMap((s) => s.recordIds)),
  })).filter((method) => otherSources.some((s) => METHOD_OF[s.type] === method.method));
  const otherColumn: OtherColumn = {
    methods,
    sources: otherSources,
    identified: count(otherSources.flatMap((s) => s.recordIds)),
    inDatabaseUnits: count(left.flatMap((s) => s.unit.memberIds.filter((id) => !isLeftRecord(id)))),
    duplicatesWithin: count(
      right.flatMap((s) => s.unit.memberIds.filter((id) => id !== s.unit.primaryId)),
    ),
    ...retrieval(right.filter((s) => s.inFullText)),
  };

  const groups = studyGroups(evaluated);
  const studyLabel = new Map(data.studies.map((study) => [study.id, study.label]));
  const reports = evaluated.filter(isIncludedReport);
  const variant =
    project.flowOverrides?.variant ?? detectVariant(project, data.sources, data.sourceRuns);
  const previous =
    project.reviewType === 'update' || variant.startsWith('update')
      ? {
          ...(project.flowOverrides?.previousStudies !== undefined && {
            studies: project.flowOverrides.previousStudies,
          }),
          ...(project.flowOverrides?.previousReports !== undefined && {
            reports: project.flowOverrides.previousReports,
          }),
        }
      : undefined;

  return {
    variant,
    detectedVariant: detectVariant(project, data.sources, data.sourceRuns),
    databases: databaseColumn,
    other: otherColumn,
    reports: primaries(reports),
    studies: {
      n: groups.length,
      recordIds: groups.flatMap((g) => g.reports.map((r) => r.unit.primaryId)),
      groups: groups.map((g) => ({
        ...(g.studyId && { studyId: g.studyId }),
        ...(g.studyId && studyLabel.has(g.studyId) && { label: studyLabel.get(g.studyId)! }),
        ...primaries(g.reports),
      })),
    },
    ...(previous && { previous }),
    checks: consistencyChecks(databaseColumn, otherColumn, variant.endsWith('_other')),
  };
}

function check(
  id: FlowCheck['id'],
  column: FlowCheck['column'],
  total: number,
  parts: number[],
  open: number,
): FlowCheck {
  const sum = parts.reduce((a, b) => a + b, 0);
  const status = total !== sum + open ? 'error' : open > 0 ? 'incomplete' : 'ok';
  return { id, column, total, parts, open, status };
}

/** PRD §5: the four equations; open units make a stage "incomplete", anything else is an error. */
function consistencyChecks(db: DatabaseColumn, other: OtherColumn, withOther: boolean) {
  const eligibility = (column: Retrieval, name: FlowCheck['column']) =>
    check(
      'eligibility',
      name,
      column.assessed.n,
      [column.reportsExcludedTotal.n, column.included.n],
      column.open.n,
    );
  const checks: FlowCheck[] = [
    check(
      'identification',
      'databases',
      db.identified.n,
      [db.duplicates.n, db.removedAutomation.n, db.removedOther.n, db.screened.n],
      0,
    ),
    check(
      'screening',
      'databases',
      db.screened.n,
      [db.excluded.n, db.sought.n],
      db.openScreening.n,
    ),
    check('retrieval', 'databases', db.sought.n, [db.notRetrieved.n, db.assessed.n], 0),
    eligibility(db, 'databases'),
  ];
  if (withOther) {
    checks.push(
      check('retrieval', 'other', other.sought.n, [other.notRetrieved.n, other.assessed.n], 0),
      eligibility(other, 'other'),
    );
  }
  return checks;
}

/** Reasons shown in the diagram: those with n > 0, in project order. */
export function drawnReasons(reasons: readonly ReasonCount[]): ReasonCount[] {
  return reasons.filter((reason) => reason.n > 0);
}
