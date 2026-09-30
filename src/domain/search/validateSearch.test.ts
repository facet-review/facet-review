import { describe, expect, it } from 'vitest';
import type { Source, SourceRun } from '../types';
import { hasErrors, validateRun, validateSource } from './validateSearch';

const source = (patch: Partial<Source> = {}): Source => ({
  id: 's',
  projectId: 'p',
  type: 'database',
  name: 'MEDLINE',
  platform: 'Ovid',
  ...patch,
});

const run = (patch: Partial<SourceRun> = {}): SourceRun => ({
  id: 'r',
  projectId: 'p',
  sourceId: 's',
  date: '2026-09-01',
  searchString: 'tutoring',
  reportedHits: 12,
  ...patch,
});

const TODAY = '2026-09-30';

describe('validateSource', () => {
  it('accepts a complete database source', () => {
    expect(validateSource(source())).toEqual([]);
  });

  it('reports missing required fields for the type', () => {
    expect(validateSource(source({ name: ' ', platform: '' }))).toEqual([
      { field: 'name', code: 'required', severity: 'error' },
      { field: 'platform', code: 'required', severity: 'error' },
    ]);
    expect(validateSource(source({ type: 'website', url: undefined }))).toEqual([
      { field: 'url', code: 'required', severity: 'error' },
    ]);
  });

  it('checks the URL format when present', () => {
    expect(validateSource(source({ type: 'register', url: 'clinicaltrials.gov' }))).toEqual([
      { field: 'url', code: 'invalidUrl', severity: 'error' },
    ]);
  });
});

describe('validateRun', () => {
  it('accepts a complete database run', () => {
    expect(validateRun('database', run(), TODAY)).toEqual([]);
  });

  it('requires the type-specific fields', () => {
    expect(
      validateRun('database', run({ searchString: '  ', reportedHits: undefined }), TODAY),
    ).toEqual([
      { field: 'searchString', code: 'required', severity: 'error' },
      { field: 'reportedHits', code: 'required', severity: 'error' },
    ]);
    expect(validateRun('citation_search', run({ searchString: '' }), TODAY)).toEqual([
      { field: 'citationDirection', code: 'required', severity: 'error' },
      { field: 'seedDocuments', code: 'required', severity: 'error' },
      { field: 'tool', code: 'required', severity: 'error' },
    ]);
  });

  it('accepts zero hits but rejects negative, fractional or non-numeric counts', () => {
    expect(validateRun('database', run({ reportedHits: 0 }), TODAY)).toEqual([]);
    for (const reportedHits of [-1, 2.5, Number.NaN]) {
      expect(validateRun('database', run({ reportedHits }), TODAY)).toEqual([
        { field: 'reportedHits', code: 'invalidNumber', severity: 'error' },
      ]);
    }
    expect(
      validateRun('search_engine', run({ recordsChecked: -3, tool: 'Publish or Perish' }), TODAY),
    ).toEqual([{ field: 'recordsChecked', code: 'invalidNumber', severity: 'error' }]);
  });

  it('requires a valid date and a non-reversed period', () => {
    expect(validateRun('database', run({ date: '' }), TODAY)).toEqual([
      { field: 'date', code: 'required', severity: 'error' },
    ]);
    expect(validateRun('database', run({ date: '2026-02-30' }), TODAY)).toEqual([
      { field: 'date', code: 'invalidDate', severity: 'error' },
    ]);
    expect(
      validateRun(
        'contact',
        run({ description: 'x', date: '2026-09-10', dateTo: '2026-09-01' }),
        TODAY,
      ),
    ).toEqual([{ field: 'dateTo', code: 'dateOrder', severity: 'error' }]);
    expect(validateRun('contact', run({ description: 'x', dateTo: 'soon' }), TODAY)).toEqual([
      { field: 'dateTo', code: 'invalidDate', severity: 'error' },
    ]);
  });

  it('only warns about dates in the future', () => {
    const issues = validateRun('database', run({ date: '2026-10-01' }), TODAY);
    expect(issues).toEqual([{ field: 'date', code: 'futureDate', severity: 'warning' }]);
    expect(hasErrors(issues)).toBe(false);
  });
});
