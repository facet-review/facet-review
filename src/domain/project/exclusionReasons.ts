import type { ExclusionReason, UUID } from '../types';
import { moveItem } from '../util/list';

export function sortedReasons(reasons: readonly ExclusionReason[]): ExclusionReason[] {
  return [...reasons].sort((a, b) => a.order - b.order);
}

/** Sorts by `order` and renumbers it to 0…n-1. */
function renumber(reasons: readonly ExclusionReason[]): ExclusionReason[] {
  return sortedReasons(reasons).map((reason, order) => ({ ...reason, order }));
}

export function createDefaultReasons(labels: readonly string[], newId: () => UUID) {
  return labels.map((label, order): ExclusionReason => ({ id: newId(), label, order }));
}

export function addReason(reasons: readonly ExclusionReason[], label: string, newId: () => UUID) {
  const current = renumber(reasons);
  return [...current, { id: newId(), label, order: current.length }];
}

export function renameReason(reasons: readonly ExclusionReason[], id: UUID, label: string) {
  return reasons.map((reason) => (reason.id === id ? { ...reason, label } : reason));
}

/**
 * Removes a reason. From milestone 4 on, callers must first check that no
 * decision references it.
 */
export function removeReason(reasons: readonly ExclusionReason[], id: UUID) {
  return renumber(reasons.filter((reason) => reason.id !== id));
}

export function moveReason(
  reasons: readonly ExclusionReason[],
  id: UUID,
  direction: -1 | 1,
): ExclusionReason[] {
  const sorted = sortedReasons(reasons);
  const index = sorted.findIndex((reason) => reason.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= sorted.length) {
    return [...reasons];
  }
  // Positions define the new order; renumbering via `renumber` would re-sort by the stale order.
  return moveItem(sorted, index, target).map((reason, order) => ({ ...reason, order }));
}
