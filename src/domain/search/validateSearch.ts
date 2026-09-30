import { isValidUrl } from '../project/validateProject';
import type { DateOnly, Source, SourceRun, SourceType } from '../types';
import { isDateOnly } from '../util/dates';
import { SOURCE_TYPE_CONFIG, type RunField, type SourceField } from './sourceTypes';

export interface SearchIssue<F extends string> {
  field: F;
  code: 'required' | 'invalidUrl' | 'invalidNumber' | 'invalidDate' | 'dateOrder' | 'futureDate';
  /** Errors block saving; warnings are shown but allowed. */
  severity: 'error' | 'warning';
}

export type SourceIssue = SearchIssue<SourceField>;
export type RunIssue = SearchIssue<RunField | 'date'>;

const isBlank = (value: unknown) =>
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

export function hasErrors(issues: readonly SearchIssue<string>[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function validateSource(source: Source): SourceIssue[] {
  const issues: SourceIssue[] = [];
  for (const field of SOURCE_TYPE_CONFIG[source.type].requiredSourceFields) {
    if (isBlank(source[field])) issues.push({ field, code: 'required', severity: 'error' });
  }
  const url = source.url?.trim();
  if (url && !isValidUrl(url)) {
    issues.push({ field: 'url', code: 'invalidUrl', severity: 'error' });
  }
  return issues;
}

export function validateRun(type: SourceType, run: SourceRun, today: DateOnly): RunIssue[] {
  const config = SOURCE_TYPE_CONFIG[type];
  const issues: RunIssue[] = [];
  const error = (field: RunIssue['field'], code: RunIssue['code']) =>
    issues.push({ field, code, severity: 'error' });

  if (isBlank(run.date)) error('date', 'required');
  else if (!isDateOnly(run.date)) error('date', 'invalidDate');
  else if (run.date > today)
    issues.push({ field: 'date', code: 'futureDate', severity: 'warning' });

  if (config.runFields.includes('dateTo') && run.dateTo !== undefined) {
    if (!isDateOnly(run.dateTo)) error('dateTo', 'invalidDate');
    else if (isDateOnly(run.date) && run.dateTo < run.date) error('dateTo', 'dateOrder');
  }

  for (const field of config.requiredRunFields) {
    if (isBlank(run[field])) error(field, 'required');
  }

  for (const field of ['reportedHits', 'recordsChecked'] as const) {
    const value = run[field];
    if (!config.runFields.includes(field) || value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) error(field, 'invalidNumber');
  }
  return issues;
}
