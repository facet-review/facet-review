import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../db/db';
import { listScreeningData } from '../../db/screeningRepository';
import { evaluateUnits } from '../../domain/screening/stages';
import { orderRecords, runColumns, screeningUnits } from '../../domain/screening/units';
import type { ScreeningStage } from '../../domain/types';
import type { StageSlug } from '../../app/modules';

export const STAGE_OF_SLUG: Record<StageSlug, ScreeningStage> = {
  'title-abstract': 'title_abstract',
  'full-text': 'full_text',
};
export const SLUG_OF_STAGE: Record<ScreeningStage, StageSlug> = {
  title_abstract: 'title-abstract',
  full_text: 'full-text',
};

/**
 * Live screening state of a project: units derived from records and stored
 * duplicate groups, evaluated against all decisions (see domain/screening).
 */
export function useScreening(projectId: string) {
  const data = useLiveQuery(() => listScreeningData(db, projectId), [projectId]);
  return useMemo(() => {
    if (!data?.project) return undefined;
    const project = data.project;
    const ordered = orderRecords(data.records, data.batches);
    const units = screeningUnits(ordered, data.groups, runColumns(data.sources, data.runs));
    const reviewerId = project.reviewers[0]?.id ?? '';
    const evaluated = evaluateUnits(units, data.decisions, reviewerId, project.screening);
    return {
      ...data,
      project,
      reviewerId,
      evaluated,
      unitOfRecord: new Map(
        evaluated.flatMap((screening) => screening.unit.memberIds.map((id) => [id, screening])),
      ),
      records: new Map(data.records.map((record) => [record.id, record])),
      runs: new Map(data.runs.map((run) => [run.id, run])),
      sources: new Map(data.sources.map((source) => [source.id, source])),
      batches: new Map(data.batches.map((batch) => [batch.id, batch])),
      studies: new Map(data.studies.map((study) => [study.id, study])),
    };
  }, [data]);
}

export type ScreeningData = NonNullable<ReturnType<typeof useScreening>>;
