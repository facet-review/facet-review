import type { DedupRecord, DedupResult } from '../../../domain/dedup/dedup';
import type { CsvMapping } from '../../../domain/import/csvFields';
import type { DedupDecision, ImportFormat } from '../../../domain/types';
import type {
  Envelope,
  ParseResponse,
  ResultEnvelope,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<ResultEnvelope>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.ok) entry.resolve(event.data.payload);
      else entry.reject(new Error(event.data.error));
    });
  }
  return worker;
}

/** Runs parsing and deduplication in a Web Worker so the interface stays responsive. */
function run(request: WorkerRequest): Promise<WorkerResponse> {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const envelope: Envelope<WorkerRequest> = { id, payload: request };
    getWorker().postMessage(envelope);
  });
}

export function parseInWorker(
  text: string,
  fileName: string,
  options: { format?: ImportFormat; mapping?: CsvMapping } = {},
): Promise<ParseResponse> {
  return run({ type: 'parse', text, fileName, ...options }) as Promise<ParseResponse>;
}

export function dedupInWorker(
  records: DedupRecord[],
  decisions: DedupDecision[],
): Promise<DedupResult> {
  return run({ type: 'dedup', records, decisions }) as Promise<DedupResult>;
}
