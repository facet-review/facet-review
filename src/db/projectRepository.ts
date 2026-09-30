import type { ISODate, Project, ProjectBundle, UUID } from '../domain/types';
import type { FacetReviewDB } from './db';

export function listProjects(db: FacetReviewDB): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export function getProject(db: FacetReviewDB, id: UUID): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function addProject(db: FacetReviewDB, project: Project): Promise<void> {
  await db.projects.add(project);
}

/**
 * Saves an edited project. Backup bookkeeping always comes from the stored
 * record – a form draft may predate the last export.
 */
export async function saveProject(db: FacetReviewDB, draft: Project, now: ISODate): Promise<void> {
  await db.transaction('rw', db.projects, async () => {
    const stored = await db.projects.get(draft.id);
    const backup = stored?.backup ?? draft.backup;
    await db.projects.put({
      ...draft,
      updatedAt: now,
      backup: { ...backup, changesSinceExport: backup.changesSinceExport + 1 },
    });
  });
}

/**
 * Marks the project as changed (updatedAt, backup counter). Call inside a
 * transaction that includes `db.projects` together with the actual change.
 */
export async function touchProject(db: FacetReviewDB, projectId: UUID, now: ISODate) {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.projects.update(projectId, {
    updatedAt: now,
    backup: { ...project.backup, changesSinceExport: project.backup.changesSinceExport + 1 },
  });
}

/** Records a successful JSON export. Does not count as an edit. */
export async function markExported(db: FacetReviewDB, id: UUID, now: ISODate): Promise<void> {
  await db.projects.update(id, { backup: { lastExportedAt: now, changesSinceExport: 0 } });
}

export async function loadBundle(
  db: FacetReviewDB,
  projectId: UUID,
): Promise<ProjectBundle | undefined> {
  return db.transaction('r', [db.projects, ...db.childTables], async () => {
    const project = await db.projects.get(projectId);
    if (!project) return undefined;
    const where = (table: FacetReviewDB['childTables'][number]) =>
      table.where('projectId').equals(projectId);
    const [sources, sourceRuns, records, duplicateGroups, decisions, studies, checklist] =
      await Promise.all([
        where(db.sources).toArray() as Promise<ProjectBundle['sources']>,
        where(db.sourceRuns).toArray() as Promise<ProjectBundle['sourceRuns']>,
        where(db.records).toArray() as Promise<ProjectBundle['records']>,
        where(db.duplicateGroups).toArray() as Promise<ProjectBundle['duplicateGroups']>,
        where(db.decisions).toArray() as Promise<ProjectBundle['decisions']>,
        where(db.studies).toArray() as Promise<ProjectBundle['studies']>,
        where(db.checklist).toArray() as Promise<ProjectBundle['checklist']>,
      ]);
    return {
      project,
      sources,
      sourceRuns,
      records,
      duplicateGroups,
      decisions,
      studies,
      checklist,
    };
  });
}

/** Deletes a project and everything that belongs to it, atomically. */
export async function deleteProject(db: FacetReviewDB, projectId: UUID): Promise<void> {
  await db.transaction('rw', [db.projects, ...db.childTables], async () => {
    await deleteChildren(db, projectId);
    await db.projects.delete(projectId);
  });
}

async function deleteChildren(db: FacetReviewDB, projectId: UUID) {
  for (const table of db.childTables) {
    await table.where('projectId').equals(projectId).delete();
  }
}

export class ProjectExistsError extends Error {
  readonly projectId: UUID;
  constructor(projectId: UUID) {
    super(`Project ${projectId} already exists`);
    this.projectId = projectId;
  }
}

/**
 * Writes a bundle atomically. `new` fails if the project id exists;
 * `replace` removes the existing project data first. For "import as copy",
 * remap ids (domain/exchange/remapIds) and use `new`.
 */
export async function importBundle(
  db: FacetReviewDB,
  bundle: ProjectBundle,
  mode: 'new' | 'replace',
): Promise<void> {
  const projectId = bundle.project.id;
  await db.transaction('rw', [db.projects, ...db.childTables], async () => {
    const exists = (await db.projects.get(projectId)) !== undefined;
    if (exists && mode === 'new') throw new ProjectExistsError(projectId);
    if (exists) {
      await deleteChildren(db, projectId);
      await db.projects.delete(projectId);
    }
    await db.projects.add(bundle.project);
    await db.sources.bulkAdd(bundle.sources);
    await db.sourceRuns.bulkAdd(bundle.sourceRuns);
    await db.records.bulkAdd(bundle.records);
    await db.duplicateGroups.bulkAdd(bundle.duplicateGroups);
    await db.decisions.bulkAdd(bundle.decisions);
    await db.studies.bulkAdd(bundle.studies);
    await db.checklist.bulkAdd(bundle.checklist);
  });
}
