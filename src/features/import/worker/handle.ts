import { deduplicate } from '../../../domain/dedup/dedup';
import { detectFormat, parseFile } from '../../../domain/import/parseFile';
import type { ParseResponse, WorkerRequest, WorkerResponse } from './protocol';

/** The work done off the main thread; also used directly where no Worker exists. */
export function handle(request: WorkerRequest): WorkerResponse {
  if (request.type === 'dedup') return deduplicate(request.records, request.decisions);
  const format = request.format ?? detectFormat(request.fileName, request.text);
  const response: ParseResponse = {
    format,
    result: format ? parseFile(request.text, format, request.mapping) : undefined,
  };
  return response;
}
