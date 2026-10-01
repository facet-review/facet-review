import type { ISODate, Project, UUID } from '../domain/types';
import type { FacetReviewDB } from './db';
import { touchProject } from './projectRepository';

/** Variant override and manually entered numbers of an update review (PRD Modul 5). */
export async function saveFlowOverrides(
  db: FacetReviewDB,
  projectId: UUID,
  overrides: NonNullable<Project['flowOverrides']>,
  now: ISODate,
) {
  const clean = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as NonNullable<Project['flowOverrides']>;
  await db.transaction('rw', db.projects, async () => {
    const project = await db.projects.get(projectId);
    if (!project) return;
    const next: Project = { ...project };
    if (Object.keys(clean).length > 0) next.flowOverrides = clean;
    else delete next.flowOverrides;
    await db.projects.put(next);
    await touchProject(db, projectId, now);
  });
}
