import type { DuplicateGroup, UUID } from '../types';
import type { DedupGroupResult } from './dedup';

/**
 * Gives recomputed groups their ids: a group keeps its id while its primary
 * record stays the same, so references to it remain stable.
 */
export function assignGroupIds(
  projectId: UUID,
  groups: readonly DedupGroupResult[],
  existing: readonly DuplicateGroup[],
  newId: () => UUID,
): DuplicateGroup[] {
  const byPrimary = new Map(existing.map((group) => [group.primaryRecordId, group.id]));
  return groups.map((group) => ({
    id: byPrimary.get(group.primaryRecordId) ?? newId(),
    projectId,
    ...group,
  }));
}
