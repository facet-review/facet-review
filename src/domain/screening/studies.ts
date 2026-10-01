import type { UUID } from '../types';
import type { DecisionInput } from './decide';
import type { UnitScreening } from './stages';
import type { ScreeningUnit } from './units';

/** Included in full-text screening ("reports of included studies"). */
export function isIncludedReport(screening: UnitScreening): boolean {
  return (
    screening.inFullText &&
    screening.fullText.state === 'decided' &&
    screening.fullText.decision!.value === 'include'
  );
}

/** Reports grouped by study; without assignment every report is its own study (PRD §5). */
export function studyGroups(evaluated: readonly UnitScreening[]) {
  const groups = new Map<string, { studyId?: UUID; reports: UnitScreening[] }>();
  for (const screening of evaluated.filter(isIncludedReport)) {
    const studyId = screening.fullText.decision!.studyId;
    const key = studyId ?? `unit:${screening.unit.key}`;
    const group = groups.get(key);
    if (group) group.reports.push(screening);
    else groups.set(key, { ...(studyId && { studyId }), reports: [screening] });
  }
  return [...groups.values()];
}

export function includedCounts(evaluated: readonly UnitScreening[]) {
  const groups = studyGroups(evaluated);
  return {
    reports: groups.reduce((sum, group) => sum + group.reports.length, 0),
    studies: groups.length,
  };
}

interface PlannedDecision {
  unit: Pick<ScreeningUnit, 'primaryId' | 'memberIds'>;
  input: DecisionInput;
}

/**
 * "This report belongs to the study of …": both reports must be included. The
 * anchor's study is reused, or a new one is created and the anchor joins it.
 * Assignments are new include decisions, so they are part of the audit trail.
 */
export function planStudyAssignment(
  report: UnitScreening,
  anchor: UnitScreening,
  deps: { newId: () => UUID; label: string },
): { study?: { id: UUID; label: string }; decisions: PlannedDecision[] } | undefined {
  if (report === anchor || !isIncludedReport(report) || !isIncludedReport(anchor)) return undefined;
  const include = (studyId: UUID): DecisionInput => ({
    stage: 'full_text',
    value: 'include',
    studyId,
  });
  const existing = anchor.fullText.decision!.studyId;
  if (existing) return { decisions: [{ unit: report.unit, input: include(existing) }] };
  const study = { id: deps.newId(), label: deps.label };
  return {
    study,
    decisions: [
      { unit: anchor.unit, input: include(study.id) },
      { unit: report.unit, input: include(study.id) },
    ],
  };
}

/** Back to "own study" (1:1). */
export function planStudyDetach(report: UnitScreening): PlannedDecision {
  return { unit: report.unit, input: { stage: 'full_text', value: 'include' } };
}
