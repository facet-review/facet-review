import type { BibRecord, ImportBatch, ImportFormat, IdSource, Clock, UUID } from '../types';
import type { ParseResult } from './types';

/** Turns parsed records into an import batch and stored records with full provenance. */
export function createImport(
  parsed: ParseResult,
  target: { projectId: UUID; sourceRunId: UUID; fileName: string; format: ImportFormat },
  deps: IdSource & Clock,
): { batch: ImportBatch; records: BibRecord[] } {
  const batch: ImportBatch = {
    id: deps.newId(),
    projectId: target.projectId,
    sourceRunId: target.sourceRunId,
    fileName: target.fileName,
    format: target.format,
    importedAt: deps.now(),
    recordCount: parsed.records.length,
    warnings: parsed.warnings,
  };
  const records = parsed.records.map((parsedRecord): BibRecord => {
    const record: BibRecord = {
      id: deps.newId(),
      projectId: target.projectId,
      sourceRunId: target.sourceRunId,
      importBatchId: batch.id,
      sourceLine: parsedRecord.line,
      csl: parsedRecord.csl,
      raw: parsedRecord.raw,
    };
    if (parsedRecord.doi) record.doi = parsedRecord.doi;
    if (parsedRecord.pmid) record.pmid = parsedRecord.pmid;
    return record;
  });
  return { batch, records };
}
