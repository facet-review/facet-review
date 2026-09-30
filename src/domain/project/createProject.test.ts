import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../testing';
import { CURRENT_SCHEMA_VERSION } from '../types';
import { createProject, setAuthor } from './createProject';

const deps = {
  newId: sequentialIds(),
  now: fixedClock('2026-09-30T10:00:00.000Z'),
};

function make() {
  return createProject(
    { title: '  Tutoring  ', reviewType: 'new', author: 'Ada', language: 'de' },
    { ...deps, newId: sequentialIds(), defaultReasonLabels: ['Population', 'Design'] },
  );
}

describe('createProject', () => {
  it('fills in all defaults', () => {
    const project = make();
    expect(project).toEqual({
      id: 'id-1',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: 'Tutoring',
      question: { text: '', framework: 'free', fields: {} },
      reviewType: 'new',
      eligibility: { inclusion: [], exclusion: [] },
      exclusionReasons: [
        { id: 'id-3', label: 'Population', order: 0 },
        { id: 'id-4', label: 'Design', order: 1 },
      ],
      registration: { registry: '', id: '', url: '', protocolUrl: '' },
      metadata: { author: 'Ada', institution: '', language: 'de' },
      reviewers: [{ id: 'id-2', name: 'Ada' }],
      searchMeta: {},
      backup: { changesSinceExport: 0 },
      createdAt: '2026-09-30T10:00:00.000Z',
      updatedAt: '2026-09-30T10:00:00.000Z',
    });
  });

  it('is deterministic for identical inputs', () => {
    expect(make()).toEqual(make());
  });
});

describe('setAuthor', () => {
  it('keeps author and single reviewer name in sync', () => {
    const next = setAuthor(make(), 'Grace');
    expect(next.metadata.author).toBe('Grace');
    expect(next.reviewers).toEqual([{ id: 'id-2', name: 'Grace' }]);
  });

  it('generates a UUID for a new reviewer by default', () => {
    const next = setAuthor({ ...make(), reviewers: [] }, 'Grace');
    expect(next.reviewers[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates a reviewer if none exists', () => {
    const project = { ...make(), reviewers: [] };
    const next = setAuthor(project, 'Grace', () => 'rev');
    expect(next.reviewers).toEqual([{ id: 'rev', name: 'Grace' }]);
  });
});
