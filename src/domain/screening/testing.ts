import type { Decision, DecisionStage, DecisionValue, UUID } from '../types';

let second = 0;

/** Decision factory for tests; timestamps increase with every call unless given. */
export function decision(
  id: string,
  recordIds: UUID[],
  stage: DecisionStage,
  value: DecisionValue,
  extra: Partial<Decision> = {},
): Decision {
  second += 1;
  const minute = String(Math.floor(second / 60) % 60).padStart(2, '0');
  return {
    id,
    projectId: 'p',
    recordIds,
    shownRecordId: recordIds[0]!,
    reviewerId: 'rev',
    stage,
    value,
    timestamp: `2026-10-01T10:${minute}:${String(second % 60).padStart(2, '0')}.000Z`,
    ...extra,
  };
}

export const unit = (key: string, ...memberIds: UUID[]) => ({
  key,
  primaryId: memberIds[0]!,
  memberIds,
  column: 'databases_registers' as const,
});
