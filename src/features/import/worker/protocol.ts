import type { DedupRecord, DedupResult } from '../../../domain/dedup/dedup';
import type { CsvMapping } from '../../../domain/import/csvFields';
import type { FileParseResult } from '../../../domain/import/parseFile';
import type { DedupDecision, ImportFormat } from '../../../domain/types';

export type WorkerRequest =
  | { type: 'parse'; text: string; fileName: string; format?: ImportFormat; mapping?: CsvMapping }
  | { type: 'dedup'; records: DedupRecord[]; decisions: DedupDecision[] };

export interface ParseResponse {
  format: ImportFormat | undefined;
  result: FileParseResult | undefined;
}

export type WorkerResponse = ParseResponse | DedupResult;

export interface Envelope<T> {
  id: number;
  payload: T;
}

export type ResultEnvelope =
  { id: number; ok: true; payload: WorkerResponse } | { id: number; ok: false; error: string };
