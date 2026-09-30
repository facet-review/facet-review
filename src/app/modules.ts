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
