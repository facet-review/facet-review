import {
  CURRENT_SCHEMA_VERSION,
  type ISODate,
  type Project,
  type ReviewType,
  type UUID,
} from '../types';
import { createDefaultReasons } from './exclusionReasons';

export interface NewProjectInput {
  title: string;
  reviewType: ReviewType;
  author: string;
  /** Language of the review itself (e.g. 'de'), not the UI language. */
  language: string;
}

export interface CreateProjectDeps {
  newId: () => UUID;
  now: () => ISODate;
  /** Labels in the UI language at creation time; afterwards they are user data. */
  defaultReasonLabels: readonly string[];
}

export function createProject(input: NewProjectInput, deps: CreateProjectDeps): Project {
  const id = deps.newId();
  const reviewer = { id: deps.newId(), name: input.author };
  const timestamp = deps.now();
  return {
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: input.title.trim(),
    question: { text: '', framework: 'free', fields: {} },
    reviewType: input.reviewType,
    eligibility: { inclusion: [], exclusion: [] },
    exclusionReasons: createDefaultReasons(deps.defaultReasonLabels, deps.newId),
    registration: { registry: '', id: '', url: '', protocolUrl: '' },
    metadata: { author: input.author, institution: '', language: input.language },
    reviewers: [reviewer],
    searchMeta: {},
    backup: { changesSinceExport: 0 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * V1 treats author and (single) reviewer as one person. Both are stored
 * separately so that teams can later be supported without a migration.
 */
export function setAuthor(
  project: Project,
  name: string,
  newId: () => UUID = () => crypto.randomUUID(),
): Project {
  const [first, ...rest] = project.reviewers;
  const reviewer = first ? { ...first, name } : { id: newId(), name };
  return {
    ...project,
    metadata: { ...project.metadata, author: name },
    reviewers: [reviewer, ...rest],
  };
}
