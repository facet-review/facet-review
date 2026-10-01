import { flowColumn } from '../search/sourceTypes';
import type { FlowVariant, Project, Source, SourceRun } from '../types';

export const FLOW_VARIANTS: readonly FlowVariant[] = [
  'new_db',
  'new_db_other',
  'update_db',
  'update_db_other',
];

/**
 * PRD Modul 5: review type (new/update) × other methods. Other methods count
 * as soon as a source of the right column (websites, organisations, citation
 * searching, other) has a search run.
 */
export function detectVariant(
  project: Pick<Project, 'reviewType'>,
  sources: readonly Pick<Source, 'id' | 'type'>[],
  runs: readonly Pick<SourceRun, 'sourceId'>[],
): FlowVariant {
  const searched = new Set(runs.map((run) => run.sourceId));
  const other = sources.some(
    (source) => flowColumn(source.type) === 'other_methods' && searched.has(source.id),
  );
  const base = project.reviewType === 'update' ? 'update_db' : 'new_db';
  return other ? `${base}_other` : base;
}

export const isUpdateVariant = (variant: FlowVariant) => variant.startsWith('update');
export const hasOtherMethods = (variant: FlowVariant) => variant.endsWith('_other');
