import type { StageFilter } from '../../domain/screening/stages';
import type { ScreeningStage } from '../../domain/types';

export const STAGE_FILTERS: Record<ScreeningStage, readonly StageFilter[]> = {
  title_abstract: ['all', 'open', 'conflict', 'review', 'include', 'exclude', 'maybe'],
  full_text: ['all', 'open', 'conflict', 'review', 'include', 'exclude', 'not_retrieved'],
};

export function parseFilter(value: string | null, stage: ScreeningStage): StageFilter {
  return STAGE_FILTERS[stage].find((filter) => filter === value) ?? 'all';
}
