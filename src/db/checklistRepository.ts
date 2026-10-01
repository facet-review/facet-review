import type { ChecklistEntry, ISODate, UUID } from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

export function listChecklist(db: FacetReviewDB, projectId: UUID): Promise<ChecklistEntry[]> {
  return db.checklist.where('projectId').equals(projectId).toArray();
}

/** Saves one checklist entry (status, where reported, note); empty text is not stored. */
export async function saveChecklistEntry(db: FacetReviewDB, entry: ChecklistEntry, now: ISODate) {
  const clean: ChecklistEntry = {
    projectId: entry.projectId,
    itemId: entry.itemId,
    status: entry.status,
  };
  const location = entry.location?.trim();
  const note = entry.note?.trim();
  if (location) clean.location = location;
  if (note) clean.note = note;
  await db.transaction('rw', [db.projects, db.checklist], async () => {
    await db.checklist.put(clean);
    await touchProject(db, entry.projectId, now);
  });
}
