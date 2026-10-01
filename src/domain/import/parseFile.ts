import type { ImportFormat } from '../types';
import { parseBibtex } from './bibtex';
import { csvToRecords, detectCsvMapping, readCsv, type CsvMapping } from './csv';
import { parseNbib } from './nbib';
import { parseRis } from './ris';
import type { ParseResult } from './types';

/** Format by content signature, then by file extension. */
export function detectFormat(fileName: string, text: string): ImportFormat | undefined {
  const head = text.slice(0, 5000);
  if (/^\s*TY {2}- /m.test(head)) return 'ris';
  if (/^PMID- /m.test(head)) return 'nbib';
  if (/^\s*@[a-z]+\s*[{(]/im.test(head)) return 'bibtex';
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'ris':
      return 'ris';
    case 'nbib':
      return 'nbib';
    case 'bib':
    case 'bibtex':
      return 'bibtex';
    case 'csv':
    case 'tsv':
      return 'csv';
    default:
      return undefined;
  }
}

export interface FileParseResult extends ParseResult {
  /** CSV only: columns and the mapping used, for the mapping dialog. */
  csv?: { headers: string[]; mapping: CsvMapping };
}

export function parseFile(
  text: string,
  format: ImportFormat,
  mapping?: CsvMapping,
): FileParseResult {
  switch (format) {
    case 'ris':
      return parseRis(text);
    case 'nbib':
      return parseNbib(text);
    case 'bibtex':
      return parseBibtex(text);
    case 'csv': {
      const table = readCsv(text);
      const used = mapping ?? detectCsvMapping(table.headers);
      const result = csvToRecords(table, used);
      return {
        records: result.records,
        warnings: [...table.warnings, ...result.warnings],
        csv: { headers: table.headers, mapping: used },
      };
    }
  }
}
