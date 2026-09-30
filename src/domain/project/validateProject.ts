import type { Project } from '../types';

export type ProjectField = 'title' | 'registration.url' | 'registration.protocolUrl';
export interface ProjectIssue {
  field: ProjectField;
  code: 'required' | 'invalidUrl';
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Returns issue codes; the UI translates them. Invalid projects are still saved (no data loss). */
export function validateProject(project: Project): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  if (project.title.trim() === '') {
    issues.push({ field: 'title', code: 'required' });
  }
  const urls = [
    ['registration.url', project.registration.url],
    ['registration.protocolUrl', project.registration.protocolUrl],
  ] as const;
  for (const [field, value] of urls) {
    if (value.trim() !== '' && !isValidUrl(value.trim())) {
      issues.push({ field, code: 'invalidUrl' });
    }
  }
  return issues;
}
