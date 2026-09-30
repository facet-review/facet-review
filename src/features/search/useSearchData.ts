import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { listRuns, listSources } from '../../db/searchRepository';

/** Sources and runs of a project, live-updating; undefined while loading. */
export function useSearchData(projectId: string) {
  return useLiveQuery(
    async () => ({
      sources: await listSources(db, projectId),
      runs: await listRuns(db, projectId),
    }),
    [projectId],
  );
}
