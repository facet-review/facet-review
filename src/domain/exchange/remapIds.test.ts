import { describe, expect, it } from 'vitest';
import { makeLinkedBundle, sequentialIds } from '../testing';
import type { ProjectBundle } from '../types';
import { remapIds } from './remapIds';

function allIds(bundle: ProjectBundle): string[] {
  return [
    bundle.project.id,
    ...bundle.project.reviewers.map((r) => r.id),
    ...bundle.project.exclusionReasons.map((r) => r.id),
    ...bundle.sources.map((s) => s.id),
    ...bundle.sourceRuns.map((r) => r.id),
    ...bundle.records.map((r) => r.id),
    ...bundle.duplicateGroups.map((g) => g.id),
    ...bundle.decisions.map((d) => d.id),
    ...bundle.studies.map((s) => s.id),
  ];
}

describe('remapIds', () => {
  const original = makeLinkedBundle();
  const copy = remapIds(original, sequentialIds('new'));

  it('assigns a fresh id to every entity', () => {
    const oldIds = new Set(allIds(original));
    const newIds = allIds(copy);
    expect(newIds.every((id) => id.startsWith('new-'))).toBe(true);
    expect(newIds.some((id) => oldIds.has(id))).toBe(false);
    expect(new Set(newIds).size).toBe(newIds.length);
  });

  it('keeps every reference resolvable', () => {
    const projectId = copy.project.id;
    const sourceIds = new Set(copy.sources.map((s) => s.id));
    const runIds = new Set(copy.sourceRuns.map((r) => r.id));
    const recordIds = new Set(copy.records.map((r) => r.id));
    const groupIds = new Set(copy.duplicateGroups.map((g) => g.id));
    const studyIds = new Set(copy.studies.map((s) => s.id));
    const reviewerIds = new Set(copy.project.reviewers.map((r) => r.id));
    const reasonIds = new Set(copy.project.exclusionReasons.map((r) => r.id));

    const children = [
      ...copy.sources,
      ...copy.sourceRuns,
      ...copy.records,
      ...copy.duplicateGroups,
      ...copy.decisions,
      ...copy.studies,
      ...copy.checklist,
    ];
    expect(children.every((c) => c.projectId === projectId)).toBe(true);
    expect(copy.sourceRuns.every((r) => sourceIds.has(r.sourceId))).toBe(true);
    for (const record of copy.records) {
      expect(runIds.has(record.sourceRunId)).toBe(true);
      if (record.duplicateGroupId) expect(groupIds.has(record.duplicateGroupId)).toBe(true);
      if (record.studyId) expect(studyIds.has(record.studyId)).toBe(true);
    }
    for (const group of copy.duplicateGroups) {
      expect(recordIds.has(group.primaryRecordId)).toBe(true);
      expect(group.memberIds.every((id) => recordIds.has(id))).toBe(true);
    }
    for (const decision of copy.decisions) {
      expect(recordIds.has(decision.recordId)).toBe(true);
      expect(reviewerIds.has(decision.reviewerId)).toBe(true);
      expect(reasonIds.has(decision.reasonId!)).toBe(true);
    }
  });

  it('preserves all non-id content', () => {
    expect(copy.project.title).toBe(original.project.title);
    expect(copy.records.map((r) => r.csl)).toEqual(original.records.map((r) => r.csl));
    expect(copy.checklist[0]?.location).toBe('p. 12');
  });

  it('does not mutate the original', () => {
    expect(original).toEqual(makeLinkedBundle());
  });
});
