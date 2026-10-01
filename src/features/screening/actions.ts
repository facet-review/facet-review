import { db } from '../../db/db';
import { addDecisions, addStudyAssignment } from '../../db/screeningRepository';
import { createDecision, type DecisionInput } from '../../domain/screening/decide';
import type { ScreeningUnit } from '../../domain/screening/units';
import type { Decision, UUID } from '../../domain/types';
import { newId, nowIso } from '../../app/runtime';

interface Who {
  projectId: UUID;
  reviewerId: UUID;
}

function build(
  who: Who,
  unit: Pick<ScreeningUnit, 'primaryId' | 'memberIds'>,
  input: DecisionInput,
) {
  const result = createDecision(unit, input, { ...who, newId, now: nowIso });
  if (!result.ok) throw new Error(`Invalid decision: ${result.errors.join(', ')}`);
  return result.value;
}

/** Appends one decision for the unit as it is now. Invalid input is a programming error. */
export async function decide(
  who: Who,
  unit: Pick<ScreeningUnit, 'primaryId' | 'memberIds'>,
  input: DecisionInput,
): Promise<Decision> {
  const decision = build(who, unit, input);
  await addDecisions(db, [decision], nowIso());
  return decision;
}

export async function assignStudy(
  who: Who,
  study: { id: UUID; label: string } | undefined,
  planned: { unit: Pick<ScreeningUnit, 'primaryId' | 'memberIds'>; input: DecisionInput }[],
) {
  const decisions = planned.map(({ unit, input }) => build(who, unit, input));
  await addStudyAssignment(
    db,
    study && { ...study, projectId: who.projectId },
    decisions,
    nowIso(),
  );
}
