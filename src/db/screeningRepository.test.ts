import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../domain/testing';
import type { Decision } from '../domain/types';
import { FacetReviewDB } from './db';
import { importBundle, ReasonInUseError, saveProject } from './projectRepository';
import {
  addDecisions,
  addStudyAssignment,
  listScreeningData,
  saveScreeningSettings,
} from './screeningRepository';

let db: FacetReviewDB;
let counter = 0;
const NOW = '2026-10-01T09:00:00.000Z';
const bundle = makeLinkedBundle();
const projectId = bundle.project.id;

const decision = (id: string, extra: Partial<Decision> = {}): Decision => ({
  id,
  projectId,
  recordIds: ['rec-1', 'rec-2'],
  shownRecordId: 'rec-1',
  reviewerId: bundle.project.reviewers[0]!.id,
  stage: 'title_abstract',
  value: 'include',
  timestamp: NOW,
  ...extra,
});

beforeEach(async () => {
  db = new FacetReviewDB(`screening-test-${++counter}`);
  await importBundle(db, { ...bundle, decisions: [], studies: [] }, 'new');
});

describe('screeningRepository', () => {
  it('appends decisions and counts them as a change', async () => {
    await addDecisions(db, [decision('d1'), decision('d2', { value: 'exclude' })], NOW);
    const data = await listScreeningData(db, projectId);
    expect(data.decisions.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    const project = await db.projects.get(projectId);
    expect(project?.updatedAt).toBe(NOW);
    expect(project?.backup.changesSinceExport).toBe(1);
  });

  it('loads everything screening needs for one project', async () => {
    const data = await listScreeningData(db, projectId);
    expect(data.project?.id).toBe(projectId);
    expect(data.records).toHaveLength(2);
    expect(data.groups).toHaveLength(1);
    expect(data.batches).toHaveLength(1);
    expect(data.sources).toHaveLength(1);
    expect(data.runs).toHaveLength(1);
    expect(data.studies).toEqual([]);
  });

  it('stores a new study together with the assigning decisions', async () => {
    const study = { id: 'study-x', projectId, label: 'Weber 2024' };
    await addStudyAssignment(
      db,
      study,
      [decision('d1', { stage: 'full_text', studyId: 'study-x' })],
      NOW,
    );
    const data = await listScreeningData(db, projectId);
    expect(data.studies).toEqual([study]);
    expect(data.decisions[0]?.studyId).toBe('study-x');
  });

  it('saves the screening settings of a project', async () => {
    const settings = { maybeToFullText: true, highlights: { include: ['tutor*'], exclude: [] } };
    await saveScreeningSettings(db, projectId, settings, NOW);
    expect((await db.projects.get(projectId))?.screening).toEqual(settings);
  });

  it('refuses to delete an exclusion reason that a decision uses', async () => {
    const project = (await db.projects.get(projectId))!;
    const reasonId = project.exclusionReasons[0]!.id;
    await addDecisions(
      db,
      [decision('d1', { stage: 'full_text', value: 'exclude', reasonId })],
      NOW,
    );
    await expect(saveProject(db, { ...project, exclusionReasons: [] }, NOW)).rejects.toBeInstanceOf(
      ReasonInUseError,
    );
    expect((await db.projects.get(projectId))?.exclusionReasons).toHaveLength(1);
  });
});
