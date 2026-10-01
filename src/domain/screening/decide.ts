import type {
  Decision,
  DecisionStage,
  DecisionValue,
  ISODate,
  Result,
  ScreeningStage,
  UUID,
} from '../types';

export interface DecisionInput {
  stage: DecisionStage;
  value: DecisionValue;
  reasonId?: UUID;
  note?: string;
  studyId?: UUID;
  undoOf?: UUID;
}

export type DecisionError =
  'invalidValue' | 'reasonRequired' | 'reasonNotAllowed' | 'studyNotAllowed' | 'noteRequired';

export const STAGE_VALUES: Readonly<Record<DecisionStage, readonly DecisionValue[]>> = {
  pre_screening: ['remove_automation', 'remove_other', 'reset'],
  title_abstract: ['include', 'exclude', 'maybe', 'reset'],
  full_text: ['include', 'exclude', 'not_retrieved', 'reset'],
};

/** PRD Modul 4: reason optional in stage 1, mandatory for full-text exclusions. */
export function validateDecision(input: DecisionInput): DecisionError[] {
  const errors: DecisionError[] = [];
  if (!STAGE_VALUES[input.stage].includes(input.value)) errors.push('invalidValue');
  if (input.reasonId && input.value !== 'exclude') errors.push('reasonNotAllowed');
  if (input.stage === 'full_text' && input.value === 'exclude' && !input.reasonId)
    errors.push('reasonRequired');
  if (input.studyId && !(input.stage === 'full_text' && input.value === 'include'))
    errors.push('studyNotAllowed');
  if (input.value.startsWith('remove_') && !input.note?.trim()) errors.push('noteRequired');
  return errors;
}

export interface DecisionContext {
  projectId: UUID;
  reviewerId: UUID;
  newId: () => UUID;
  now: () => ISODate;
}

/** A decision about the whole unit as it is now (all members, shown = primary). */
export function createDecision(
  unit: { primaryId: UUID; memberIds: readonly UUID[] },
  input: DecisionInput,
  ctx: DecisionContext,
): Result<Decision, DecisionError> {
  const errors = validateDecision(input);
  if (errors.length > 0) return { ok: false, errors };
  const note = input.note?.trim();
  return {
    ok: true,
    value: {
      id: ctx.newId(),
      projectId: ctx.projectId,
      recordIds: [...unit.memberIds],
      shownRecordId: unit.primaryId,
      reviewerId: ctx.reviewerId,
      stage: input.stage,
      value: input.value,
      ...(input.reasonId && { reasonId: input.reasonId }),
      ...(note && { note }),
      ...(input.studyId && { studyId: input.studyId }),
      ...(input.undoOf && { undoOf: input.undoOf }),
      timestamp: ctx.now(),
    },
  };
}

const chronological = (a: Decision, b: Decision) =>
  a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id);

/**
 * "Z": the most recent decision of this reviewer and stage that is no undo and
 * not undone yet, and the input that restores the state before it (append-only:
 * the undo is a new entry pointing to its target via `undoOf`).
 */
export function undoLast(decisions: readonly Decision[], stage: ScreeningStage, reviewerId: UUID) {
  const own = decisions
    .filter((d) => d.reviewerId === reviewerId && d.stage === stage)
    .sort(chronological);
  const undone = new Set(own.map((d) => d.undoOf).filter(Boolean));
  const target = own.findLast((d) => !d.undoOf && !undone.has(d.id));
  if (!target) return undefined;
  const before = own
    .slice(0, own.indexOf(target))
    .findLast((d) => d.recordIds.includes(target.shownRecordId));
  const input: DecisionInput = before
    ? {
        stage,
        value: before.value,
        ...(before.reasonId && { reasonId: before.reasonId }),
        ...(before.note && { note: before.note }),
        ...(before.studyId && { studyId: before.studyId }),
        undoOf: target.id,
      }
    : { stage, value: 'reset', undoOf: target.id };
  return {
    target,
    unit: { memberIds: target.recordIds, primaryId: target.shownRecordId },
    input,
  };
}

/** Exclusion reasons referenced by a decision cannot be deleted (audit trail). */
export function reasonInUse(decisions: readonly Decision[], reasonId: UUID): boolean {
  return decisions.some((d) => d.reasonId === reasonId);
}
