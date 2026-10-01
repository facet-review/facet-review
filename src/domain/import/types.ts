import type { CslItem, ImportWarning } from '../types';

/** One record as read from a file, before it gets ids and provenance. */
export interface ParsedRecord {
  csl: CslItem;
  /** The original entry, unchanged (line endings normalised to \n). */
  raw: string;
  /** 1-based line where the entry starts. */
  line: number;
  doi?: string;
  pmid?: string;
}

/** Parsers never throw: problems are warnings, the rest of the file is kept. */
export interface ParseResult {
  records: ParsedRecord[];
  warnings: ImportWarning[];
}
