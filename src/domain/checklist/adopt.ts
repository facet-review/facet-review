import type { ChecklistEntry, UUID } from '../types';

export interface Suggestion {
  note: string;
  location?: string;
}

/**
 * Applies a suggestion to an entry. Fields that already hold different text
 * are listed in `overwrites`; the caller must confirm before saving those.
 * The item counts as done afterwards unless it was marked "not applicable".
 */
export function adoptSuggestion(
  entry: ChecklistEntry | undefined,
  base: { projectId: UUID; itemId: string },
  suggestion: Suggestion,
): { entry: ChecklistEntry; overwrites: ('note' | 'location')[] } {
  const current: ChecklistEntry = entry ?? { ...base, status: 'open' };
  const overwrites: ('note' | 'location')[] = [];
  const next: ChecklistEntry = {
    ...current,
    status: current.status === 'na' ? 'na' : 'done',
  };
  for (const field of ['note', 'location'] as const) {
    const value = suggestion[field];
    if (value === undefined) continue;
    const existing = current[field]?.trim();
    if (existing && existing !== value) overwrites.push(field);
    next[field] = value;
  }
  return { entry: next, overwrites };
}

export function checklistProgress(entries: readonly ChecklistEntry[], itemIds: readonly string[]) {
  const status = new Map(entries.map((entry) => [entry.itemId, entry.status]));
  const count = (value: ChecklistEntry['status']) =>
    itemIds.filter((id) => (status.get(id) ?? 'open') === value).length;
  return { total: itemIds.length, done: count('done'), na: count('na'), open: count('open') };
}
