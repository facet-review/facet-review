import type { Decision, ScreeningSettings, ScreeningStage, UUID } from '../types';
import { indexDecisions, stageStatus, unitHistory, type StageStatus } from './status';
import type { ScreeningUnit } from './units';

export interface UnitScreening {
  unit: ScreeningUnit;
  removal: StageStatus;
  titleAbstract: StageStatus;
  fullText: StageStatus;
  /** Removed before screening (automation tool or other reason). */
  removed: boolean;
  inTitleAbstract: boolean;
  /** "Reports sought for retrieval". */
  inFullText: boolean;
  history: Decision[];
}

export function evaluateUnits(
  units: readonly ScreeningUnit[],
  decisions: readonly Decision[],
  reviewerId: UUID,
  settings: ScreeningSettings,
): UnitScreening[] {
  const index = indexDecisions(decisions, reviewerId);
  return units.map((unit) => {
    const removal = stageStatus(unit, index, 'pre_screening');
    const titleAbstract = stageStatus(unit, index, 'title_abstract');
    const fullText = stageStatus(unit, index, 'full_text');
    const removed = removal.state !== 'open';
    const passed =
      titleAbstract.state === 'decided' &&
      (titleAbstract.decision!.value === 'include' ||
        (titleAbstract.decision!.value === 'maybe' && settings.maybeToFullText));
    return {
      unit,
      removal,
      titleAbstract,
      fullText,
      removed,
      inTitleAbstract: !removed && unit.column === 'databases_registers',
      inFullText: !removed && (unit.column === 'other_methods' || passed),
      history: unitHistory(unit, index),
    };
  });
}

export const statusIn = (screening: UnitScreening, stage: ScreeningStage) =>
  stage === 'title_abstract' ? screening.titleAbstract : screening.fullText;

const inStage = (screening: UnitScreening, stage: ScreeningStage) =>
  stage === 'title_abstract' ? screening.inTitleAbstract : screening.inFullText;

export type StageFilter =
  'all' | 'open' | 'conflict' | 'review' | 'include' | 'exclude' | 'maybe' | 'not_retrieved';

function matches(status: StageStatus, filter: StageFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return status.state !== 'decided';
    case 'conflict':
      return status.state === 'conflict';
    case 'review':
      return status.state === 'open' && status.suggestion !== undefined;
    default:
      return status.state === 'decided' && status.decision!.value === filter;
  }
}

/** Conflicts first, then split-off parts awaiting review, then the stable unit order. */
function priority(status: StageStatus): number {
  if (status.state === 'conflict') return 0;
  if (status.state === 'open' && status.suggestion) return 1;
  return 2;
}

export function stageItems(
  evaluated: readonly UnitScreening[],
  stage: ScreeningStage,
  filter: StageFilter,
): UnitScreening[] {
  return evaluated
    .map((screening, order) => ({ screening, order }))
    .filter(({ screening }) => inStage(screening, stage))
    .filter(({ screening }) => matches(statusIn(screening, stage), filter))
    .sort(
      (a, b) =>
        priority(statusIn(a.screening, stage)) - priority(statusIn(b.screening, stage)) ||
        a.order - b.order,
    )
    .map(({ screening }) => screening);
}

export interface StageProgress {
  total: number;
  decided: number;
  /** Includes conflicts and split-off parts. */
  open: number;
  conflicts: number;
  review: number;
  counts: { include: number; exclude: number; maybe: number; not_retrieved: number };
}

export function stageProgress(
  evaluated: readonly UnitScreening[],
  stage: ScreeningStage,
): StageProgress {
  const progress: StageProgress = {
    total: 0,
    decided: 0,
    open: 0,
    conflicts: 0,
    review: 0,
    counts: { include: 0, exclude: 0, maybe: 0, not_retrieved: 0 },
  };
  for (const screening of evaluated) {
    if (!inStage(screening, stage)) continue;
    const status = statusIn(screening, stage);
    progress.total += 1;
    if (status.state === 'decided') {
      progress.decided += 1;
      const value = status.decision!.value;
      if (value in progress.counts) progress.counts[value as keyof StageProgress['counts']] += 1;
    } else {
      progress.open += 1;
      if (status.state === 'conflict') progress.conflicts += 1;
      else if (status.suggestion) progress.review += 1;
    }
  }
  return progress;
}

/**
 * PRD Modul 4: before full-text screening all maybes must be resolved, unless
 * the reviewer takes them along (setting). Undecided records only warn.
 */
export function fullTextGate(evaluated: readonly UnitScreening[], settings: ScreeningSettings) {
  const progress = stageProgress(evaluated, 'title_abstract');
  return {
    locked: !settings.maybeToFullText && progress.counts.maybe > 0,
    maybes: progress.counts.maybe,
    openTitleAbstract: progress.open,
  };
}
