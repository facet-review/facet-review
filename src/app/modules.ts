/** The six modules of Facet Review in workflow order, with the milestone that implements them. */
export const MODULES = [
  { key: 'project', path: 'project', milestone: 1 },
  { key: 'search', path: 'search', milestone: 2 },
  { key: 'import', path: 'import', milestone: 3 },
  { key: 'screening', path: 'screening', milestone: 4 },
  { key: 'flow', path: 'flow', milestone: 5 },
  { key: 'checklist', path: 'checklist', milestone: 6 },
] as const;

export type ModuleKey = (typeof MODULES)[number]['key'];

export const projectPath = (projectId: string, module: ModuleKey = 'project') =>
  `/projects/${projectId}/${module}`;

export const searchPaths = {
  page: (projectId: string) => `/projects/${projectId}/search`,
  newSource: (projectId: string) => `/projects/${projectId}/search/sources/new`,
  source: (projectId: string, sourceId: string) =>
    `/projects/${projectId}/search/sources/${sourceId}`,
  newRun: (projectId: string, sourceId: string) =>
    `/projects/${projectId}/search/sources/${sourceId}/runs/new`,
  run: (projectId: string, runId: string) => `/projects/${projectId}/search/runs/${runId}`,
};

export const importPaths = {
  page: (projectId: string) => `/projects/${projectId}/import`,
  run: (projectId: string, runId: string) => `/projects/${projectId}/import/runs/${runId}`,
  duplicates: (projectId: string) => `/projects/${projectId}/import/duplicates`,
};

/** URL form of the screening stages. */
export type StageSlug = 'title-abstract' | 'full-text';

export const screeningPaths = {
  page: (projectId: string, stage?: StageSlug, filter?: string) => {
    const query = new URLSearchParams({
      ...(stage && { stage }),
      ...(filter && filter !== 'all' && { filter }),
    }).toString();
    return `/projects/${projectId}/screening${query ? `?${query}` : ''}`;
  },
  /** A screening unit, addressed by one of its records (stable across dedup changes). */
  unit: (projectId: string, stage: StageSlug, recordId: string, filter?: string) =>
    `/projects/${projectId}/screening/${stage}/${recordId}${
      filter && filter !== 'all' ? `?filter=${filter}` : ''
    }`,
};
