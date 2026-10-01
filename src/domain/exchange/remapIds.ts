import type { ProjectBundle, UUID } from '../types';

/**
 * Returns a copy of the bundle in which every entity id is replaced by a fresh
 * one and every reference follows. Used for "import as copy". References that
 * point nowhere get fresh ids too, so no id of the original survives.
 */
export function remapIds(bundle: ProjectBundle, newId: () => UUID): ProjectBundle {
  const ids = new Map<UUID, UUID>();
  const map = (id: UUID): UUID => {
    let mapped = ids.get(id);
    if (!mapped) {
      mapped = newId();
      ids.set(id, mapped);
    }
    return mapped;
  };
  const opt = (id: UUID | undefined) => (id === undefined ? undefined : map(id));

  const { project } = bundle;
  const projectId = map(project.id);
  return {
    project: {
      ...project,
      id: projectId,
      reviewers: project.reviewers.map((r) => ({ ...r, id: map(r.id) })),
      exclusionReasons: project.exclusionReasons.map((r) => ({ ...r, id: map(r.id) })),
    },
    sources: bundle.sources.map((s) => ({ ...s, id: map(s.id), projectId })),
    sourceRuns: bundle.sourceRuns.map((r) => ({
      ...r,
      id: map(r.id),
      projectId,
      sourceId: map(r.sourceId),
    })),
    importBatches: bundle.importBatches.map((b) => ({
      ...b,
      id: map(b.id),
      projectId,
      sourceRunId: map(b.sourceRunId),
    })),
    records: bundle.records.map((r) =>
      withoutUndefined({
        ...r,
        id: map(r.id),
        projectId,
        sourceRunId: map(r.sourceRunId),
        importBatchId: map(r.importBatchId),
        duplicateGroupId: opt(r.duplicateGroupId),
      }),
    ),
    duplicateGroups: bundle.duplicateGroups.map((g) => ({
      ...g,
      id: map(g.id),
      projectId,
      primaryRecordId: map(g.primaryRecordId),
      memberIds: g.memberIds.map(map),
      links: g.links.map((link) => ({ ...link, a: map(link.a), b: map(link.b) })),
    })),
    dedupDecisions: bundle.dedupDecisions.map((d) => ({
      ...d,
      id: map(d.id),
      projectId,
      recordIds: d.recordIds.map(map),
      reviewerId: map(d.reviewerId),
    })),
    decisions: bundle.decisions.map((d) =>
      withoutUndefined({
        ...d,
        id: map(d.id),
        projectId,
        recordIds: d.recordIds.map(map),
        shownRecordId: map(d.shownRecordId),
        reviewerId: map(d.reviewerId),
        reasonId: opt(d.reasonId),
        studyId: opt(d.studyId),
        undoOf: opt(d.undoOf),
      }),
    ),
    studies: bundle.studies.map((s) => ({ ...s, id: map(s.id), projectId })),
    checklist: bundle.checklist.map((c) => ({ ...c, projectId })),
  };
}

/** Keeps optional properties absent instead of present-but-undefined (IndexedDB/JSON parity). */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
