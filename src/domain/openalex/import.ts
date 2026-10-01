import { createImport } from '../import/createImport';
import type {
  BibRecord,
  Clock,
  DateOnly,
  IdSource,
  ImportBatch,
  Source,
  SourceRun,
  UUID,
} from '../types';
import { buildWorksUrl, PAGE_SIZE } from './query';
import { OPENALEX_SOURCE, runFromQuery, type ProtocolLabel } from './protocol';
import type { OpenAlexQuery, OpenAlexWork } from './types';
import { worksToParseResult } from './works';

/** The project's OpenAlex source, created on the first search and reused afterwards. */
export function findOpenAlexSource(sources: readonly Source[]): Source | undefined {
  return sources.find(
    (source) =>
      source.type === 'database' &&
      source.name === OPENALEX_SOURCE.name &&
      source.platform === OPENALEX_SOURCE.platform,
  );
}

export interface OpenAlexImport {
  /** Only set when the source is new. */
  newSource?: Source;
  run: SourceRun;
  batch: ImportBatch;
  records: BibRecord[];
}

/**
 * Everything one completed OpenAlex search adds to the chain: source (first
 * time), documented search run, import batch and records – stored together.
 */
export function createOpenAlexImport(
  query: OpenAlexQuery,
  result: { works: readonly OpenAlexWork[]; count: number },
  context: { projectId: UUID; sources: readonly Source[]; date: DateOnly; label: ProtocolLabel },
  deps: IdSource & Clock,
): OpenAlexImport {
  const existing = findOpenAlexSource(context.sources);
  const source: Source = existing ?? {
    id: deps.newId(),
    projectId: context.projectId,
    type: 'database',
    ...OPENALEX_SOURCE,
  };
  const run = runFromQuery(
    query,
    {
      id: deps.newId(),
      projectId: context.projectId,
      sourceId: source.id,
      date: context.date,
      count: result.count,
    },
    context.label,
  );
  const { batch, records } = createImport(
    worksToParseResult(result.works),
    {
      projectId: context.projectId,
      sourceRunId: run.id,
      fileName: buildWorksUrl(query, { perPage: PAGE_SIZE, cursor: '*' }),
      format: 'openalex',
    },
    deps,
  );
  return { ...(existing ? {} : { newSource: source }), run, batch, records };
}
