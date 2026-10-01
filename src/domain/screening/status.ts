import type { Decision, DecisionStage, UUID } from '../types';

/** Decisions per record, oldest first. */
export type DecisionIndex = ReadonlyMap<UUID, readonly Decision[]>;

const chronological = (a: Decision, b: Decision) =>
  a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id);

/** Indexes one reviewer's decisions by every record they refer to. */
export function indexDecisions(decisions: readonly Decision[], reviewerId: UUID): DecisionIndex {
  const index = new Map<UUID, Decision[]>();
  for (const decision of [...decisions].sort(chronological)) {
    if (decision.reviewerId !== reviewerId) continue;
    for (const id of decision.recordIds) {
      const list = index.get(id);
      if (list) list.push(decision);
      else index.set(id, [decision]);
    }
  }
  return index;
}

export interface StageStatus {
  /** `conflict`: members carry contradicting decisions (e.g. after a merge); counts as open. */
  state: 'open' | 'decided' | 'conflict';
  /** The effective decision when decided. */
  decision?: Decision;
  /** One decision per contradicting outcome when in conflict. */
  conflicting: Decision[];
  /** Open part of a split unit: the decision made on the former unit (shown elsewhere). */
  suggestion?: Decision;
  /** Decided, but the decision was made on a different set of records (merge, split, new import). */
  inherited: boolean;
}

/**
 * What counts as "the same outcome". In title/abstract screening the reason is
 * optional and not reported, so only the value matters; in full-text screening
 * reason and study determine the flow diagram boxes.
 */
function outcome(decision: Decision): string {
  return decision.stage === 'full_text'
    ? [decision.value, decision.reasonId ?? '', decision.studyId ?? ''].join('|')
    : decision.value;
}

/**
 * Status of a screening unit in one stage, derived from its members' latest
 * decisions (see PRD §4, "Screening-Entscheidungen"):
 * - a member's decision counts if the record shown at the time is in the unit;
 *   otherwise it was made on a different publication and is only a suggestion;
 * - no counting decision → open; all agree → decided; contradiction → conflict.
 */
export function stageStatus(
  unit: { memberIds: readonly UUID[] },
  index: DecisionIndex,
  stage: DecisionStage,
): StageStatus {
  const members = new Set(unit.memberIds);
  const seen = new Map<UUID, Decision>();
  let suggestion: Decision | undefined;
  for (const id of unit.memberIds) {
    const latest = index
      .get(id)
      ?.filter((d) => d.stage === stage)
      .at(-1);
    if (!latest || latest.value === 'reset') continue;
    if (members.has(latest.shownRecordId)) seen.set(latest.id, latest);
    else if (!suggestion || chronological(suggestion, latest) < 0) suggestion = latest;
  }

  const decisions = [...seen.values()].sort(chronological);
  if (decisions.length === 0) {
    return { state: 'open', conflicting: [], inherited: false, ...(suggestion && { suggestion }) };
  }
  const byOutcome = new Map<string, Decision>();
  for (const decision of decisions) byOutcome.set(outcome(decision), decision);
  if (byOutcome.size > 1) {
    return {
      state: 'conflict',
      conflicting: [...byOutcome.values()].sort(chronological),
      inherited: false,
    };
  }
  const decision = decisions.at(-1)!;
  const inherited =
    decision.recordIds.length !== members.size || decision.recordIds.some((id) => !members.has(id));
  return { state: 'decided', decision, conflicting: [], inherited };
}

/** Audit trail of a unit: every decision touching one of its records, newest first. */
export function unitHistory(unit: { memberIds: readonly UUID[] }, index: DecisionIndex) {
  const all = new Map<UUID, Decision>();
  for (const id of unit.memberIds) for (const d of index.get(id) ?? []) all.set(d.id, d);
  return [...all.values()].sort(chronological).reverse();
}
