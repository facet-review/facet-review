import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../testing';
import { createProject } from './createProject';
import { isValidUrl, validateProject } from './validateProject';

const base = createProject(
  { title: 'T', reviewType: 'new', author: '', language: 'de' },
  { newId: sequentialIds(), now: fixedClock('2026-01-01T00:00:00.000Z'), defaultReasonLabels: [] },
);

describe('validateProject', () => {
  it('accepts a minimal valid project', () => {
    expect(validateProject(base)).toEqual([]);
  });

  it('requires a non-blank title', () => {
    expect(validateProject({ ...base, title: '   ' })).toEqual([
      { field: 'title', code: 'required' },
    ]);
  });

  it('checks registration URLs only when filled', () => {
    const project = {
      ...base,
      registration: { ...base.registration, url: 'osf.io/abc', protocolUrl: 'https://osf.io/x' },
    };
    expect(validateProject(project)).toEqual([{ field: 'registration.url', code: 'invalidUrl' }]);
  });

  it('flags an invalid protocol URL', () => {
    const project = { ...base, registration: { ...base.registration, protocolUrl: 'ftp://x' } };
    expect(validateProject(project)).toEqual([
      { field: 'registration.protocolUrl', code: 'invalidUrl' },
    ]);
  });
});

describe('isValidUrl', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isValidUrl('https://www.crd.york.ac.uk/prospero/')).toBe(true);
    expect(isValidUrl('http://example.org')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });
});
