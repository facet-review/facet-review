import { formatAuthors } from '../dedup/compare';
import type { FlowInput } from '../flow/computeFlow';
import { yearOf } from '../import/normalize';
import { sourceLabel } from '../search/summary';
import { evaluateUnits, type UnitScreening } from '../screening/stages';
import type { StageStatus } from '../screening/status';
import { isIncludedReport } from '../screening/studies';
import { orderRecords, runColumns, screeningUnits } from '../screening/units';
import type { BibRecord, DecisionValue, UUID } from '../types';
import type { ExportLabels } from './labels';
import { toRis, type RisInput } from './ris';

type Row = string[];

/** Units and their status, derived exactly as in screening and flow (milestone 4). */
function evaluate(data: FlowInput) {
  const columns = runColumns(data.sources, data.sourceRuns);
  const ordered = orderRecords(data.records, data.importBatches);
  const units = screeningUnits(ordered, data.duplicateGroups, columns);
  const reviewerId = data.project.reviewers[0]?.id ?? '';
  const evaluated = evaluateUnits(units, data.decisions, reviewerId, data.project.screening);
  const unitOf = new Map<UUID, UnitScreening>();
  for (const screening of evaluated)
    for (const id of screening.unit.memberIds) unitOf.set(id, screening);
  const runs = new Map(data.sourceRuns.map((run) => [run.id, run]));
  const sources = new Map(data.sources.map((source) => [source.id, source]));
  const sourceOf = (record: BibRecord) => {
    const run = runs.get(record.sourceRunId);
    const source = run && sources.get(run.sourceId);
    return { run, label: source ? sourceLabel(source) : '' };
  };
  return { ordered, evaluated, unitOf, sourceOf };
}

const attribution = (t: ExportLabels): Row[] => [[], [t('source2020')], [t('license')]];

function studyLabel(data: FlowInput, screening: UnitScreening, t: ExportLabels): string {
  const studyId = screening.fullText.decision?.studyId;
  if (!studyId) return t('ownStudy');
  return data.studies.find((study) => study.id === studyId)?.label ?? studyId;
}

function bibliographic(record: BibRecord | undefined) {
  const csl = record?.csl ?? {};
  return [
    csl.title ?? '',
    formatAuthors(csl),
    String(yearOf(csl) ?? ''),
    csl['container-title'] ?? '',
    record?.doi ?? '',
    record?.pmid ?? '',
  ];
}

/** Included reports (primary record per unit) with their study (PRD, Exporte). */
export function includedRows(data: FlowInput, t: ExportLabels): Row[] {
  const { evaluated, sourceOf } = evaluate(data);
  const records = new Map(data.records.map((record) => [record.id, record]));
  const rows: Row[] = [
    [
      t('study'),
      t('title'),
      t('authors'),
      t('year'),
      t('container'),
      t('doi'),
      t('pmid'),
      t('sources'),
      t('recordId'),
    ],
  ];
  for (const screening of evaluated.filter(isIncludedReport)) {
    const primary = records.get(screening.unit.primaryId);
    const sources = [
      ...new Set(
        screening.unit.memberIds
          .map((id) => records.get(id))
          .filter((record): record is BibRecord => record !== undefined)
          .map((record) => sourceOf(record).label),
      ),
    ];
    rows.push([
      studyLabel(data, screening, t),
      ...bibliographic(primary),
      sources.join('; '),
      screening.unit.primaryId,
    ]);
  }
  return [...rows, ...attribution(t)];
}

/** The same reports as RIS; the study travels as a note. No attribution: RIS has no comments. */
export function includedRis(data: FlowInput, t: ExportLabels): string {
  const { evaluated } = evaluate(data);
  const records = new Map(data.records.map((record) => [record.id, record]));
  const entries: RisInput[] = evaluated.filter(isIncludedReport).flatMap((screening) => {
    const record = records.get(screening.unit.primaryId);
    if (!record) return [];
    return [
      {
        csl: record.csl,
        ...(record.doi && { doi: record.doi }),
        ...(record.pmid && { pmid: record.pmid }),
        notes: [`${t('study')}: ${studyLabel(data, screening, t)}`],
      },
    ];
  });
  return toRis(entries);
}

function statusText(status: StageStatus, inStage: boolean, t: ExportLabels): string {
  if (!inStage) return t('notInStage');
  if (status.state === 'conflict') return t('conflict');
  if (status.state === 'open') return status.suggestion ? t('review') : t('open');
  return t(status.decision!.value as DecisionValue);
}

/**
 * Every imported record with provenance, unit, status in both stages and the
 * full decision history (PRD, Exporte: "Alle Datensätze mit Status und Entscheidungen").
 */
export function recordRows(data: FlowInput, t: ExportLabels): Row[] {
  const { ordered, unitOf, sourceOf } = evaluate(data);
  const reasons = new Map(data.project.exclusionReasons.map((r) => [r.id, r.label]));
  const batches = new Map(data.importBatches.map((batch) => [batch.id, batch]));
  const reason = (status: StageStatus) =>
    status.state === 'decided' && status.decision!.reasonId
      ? (reasons.get(status.decision!.reasonId) ?? '')
      : '';

  const rows: Row[] = [
    [
      t('recordId'),
      t('unit'),
      t('role'),
      t('source'),
      t('searchDate'),
      t('file'),
      t('line'),
      t('title'),
      t('authors'),
      t('year'),
      t('container'),
      t('doi'),
      t('pmid'),
      t('removed'),
      t('removedNote'),
      t('titleAbstract'),
      t('titleAbstractReason'),
      t('fullText'),
      t('fullTextReason'),
      t('study'),
      t('flags'),
      t('history'),
    ],
  ];
  for (const record of ordered) {
    const screening = unitOf.get(record.id);
    if (!screening) continue;
    const { unit } = screening;
    const { run, label } = sourceOf(record);
    const removal = screening.removal.decision ?? screening.removal.conflicting[0];
    const flags = [
      screening.titleAbstract.inherited || screening.fullText.inherited ? t('inherited') : '',
    ].filter(Boolean);
    const history = [...screening.history]
      .reverse()
      .map((d) =>
        [
          d.timestamp,
          t(d.stage),
          t(d.value),
          d.reasonId ? `(${reasons.get(d.reasonId) ?? ''})` : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join(' | ');
    rows.push([
      record.id,
      unit.primaryId,
      record.id === unit.primaryId ? t('primary') : `${t('duplicateOf')} ${unit.primaryId}`,
      label,
      run?.date ?? '',
      batches.get(record.importBatchId)?.fileName ?? '',
      record.sourceLine === undefined ? '' : String(record.sourceLine),
      ...bibliographic(record),
      screening.removed && removal ? t(removal.value) : '',
      screening.removed ? (removal?.note ?? '') : '',
      statusText(screening.titleAbstract, screening.inTitleAbstract, t),
      reason(screening.titleAbstract),
      statusText(screening.fullText, screening.inFullText, t),
      reason(screening.fullText),
      isIncludedReport(screening) ? studyLabel(data, screening, t) : '',
      flags.join(', '),
      history,
    ]);
  }
  return [...rows, ...attribution(t)];
}
