import type { Decision, ISODate, ScreeningSettings, Study, UUID } from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

/** Everything screening derives its units and statuses from. */
export async function listScreeningData(db: FacetReviewDB, projectId: UUID) {
  const [project, sources, runs, batches, records, groups, decisions, studies] = await Promise.all([
    db.projects.get(projectId),
    db.sources.where('projectId').equals(projectId).toArray(),
    db.sourceRuns.where('projectId').equals(projectId).toArray(),
    db.importBatches.where('projectId').equals(projectId).toArray(),
    db.records.where('projectId').equals(projectId).toArray(),
    db.duplicateGroups.where('projectId').equals(projectId).toArray(),
    db.decisions.where('projectId').equals(projectId).toArray(),
    db.studies.where('projectId').equals(projectId).toArray(),
  ]);
  return { project, sources, runs, batches, records, groups, decisions, studies };
}

/** Appends decisions (append-only audit trail) atomically. */
export async function addDecisions(db: FacetReviewDB, decisions: Decision[], now: ISODate) {
  const projectId = decisions[0]?.projectId;
  if (!projectId) return;
  await db.transaction('rw', [db.projects, db.decisions], async () => {
    await db.decisions.bulkAdd(decisions);
    await touchProject(db, projectId, now);
  });
}

/** "Report belongs to study …": a new study (if any) and its include decisions together. */
export async function addStudyAssignment(
  db: FacetReviewDB,
  study: Study | undefined,
  decisions: Decision[],
  now: ISODate,
) {
  await db.transaction('rw', [db.projects, db.decisions, db.studies], async () => {
    if (study) await db.studies.add(study);
    await db.decisions.bulkAdd(decisions);
    const projectId = study?.projectId ?? decisions[0]?.projectId;
    if (projectId) await touchProject(db, projectId, now);
  });
}

export async function saveScreeningSettings(
  db: FacetReviewDB,
  projectId: UUID,
  settings: ScreeningSettings,
  now: ISODate,
) {
  await db.transaction('rw', db.projects, async () => {
    await db.projects.update(projectId, { screening: settings });
    await touchProject(db, projectId, now);
  });
}
