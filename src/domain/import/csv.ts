import Papa from 'papaparse';
import type { CslName, ImportWarning } from '../types';
import { cleanText, compactCsl, pages, parseIssued } from './fields';
import { normalizeDoi, normalizePmid, parsePersonName } from './normalize';
import type { ParsedRecord, ParseResult } from './types';

export { CSV_FIELDS, type CsvField, type CsvMapping } from './csvFields';
import type { CsvField, CsvMapping } from './csvFields';
import { CSV_FIELDS } from './csvFields';

export interface CsvTable {
  headers: string[];
  rows: { line: number; cells: string[] }[];
  warnings: ImportWarning[];
}

/** Reads a CSV file (delimiter detected: comma, semicolon or tab) with line numbers per row. */
export function readCsv(text: string): CsvTable {
  const content = text.replace(/^\uFEFF/, '');
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) if (content[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (offset: number) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (lineStarts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };

  const parsed: { line: number; cells: string[] }[] = [];
  let offset = 0;
  Papa.parse<string[]>(content, {
    delimiter: detectDelimiter(content),
    step: (result) => {
      const start = offset;
      offset = result.meta.cursor;
      const cells = result.data;
      if (cells.length === 1 && cells[0] === '') return; // empty line
      // A row starts after the line break that ended the previous row.
      const rowStart = content.slice(start).match(/^[\r\n]*/)?.[0].length ?? 0;
      parsed.push({ line: lineAt(start + rowStart), cells });
    },
  });

  const [header, ...rows] = parsed;
  const headers = (header?.cells ?? []).map((cell) => cell.trim());
  const warnings: ImportWarning[] = rows
    .filter((row) => row.cells.length !== headers.length)
    .map((row) => ({ code: 'csvColumnCount', line: row.line }));
  return { headers, rows, warnings };
}

/**
 * Delimiter from the header line (headers practically never contain line
 * breaks, unlike data cells): the most frequent of comma, semicolon and tab.
 */
function detectDelimiter(content: string): string {
  const header = content.split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => header.split(char).length - 1;
  return [',', ';', '\t'].reduce((best, char) => (count(char) > count(best) ? char : best), ',');
}

const ALIASES: Record<CsvField, readonly string[]> = {
  title: ['title', 'article title', 'document title', 'primary title', 'ti'],
  authors: ['author full names', 'authors', 'author', 'author(s)', 'au'],
  year: ['year', 'publication year', 'pubyear', 'py'],
  container: [
    'source title',
    'journal',
    'journal title',
    'publication title',
    'secondary title',
    'source',
    'so',
  ],
  doi: ['doi'],
  pmid: ['pmid', 'pubmed id'],
  abstract: ['abstract', 'ab'],
  volume: ['volume', 'vl'],
  issue: ['issue', 'is'],
  pages: ['pages', 'pp'],
  pageStart: ['page start', 'start page'],
  pageEnd: ['page end', 'end page'],
  keywords: ['author keywords', 'keywords', 'kw'],
  type: ['document type', 'type'],
  language: ['language of original document', 'language'],
  url: ['url', 'link'],
  publisher: ['publisher'],
  issn: ['issn'],
};

/** Suggests a column per field by header name; the user can correct it in the mapping dialog. */
export function detectCsvMapping(headers: readonly string[]): CsvMapping {
  const lower = headers.map((header) => header.trim().toLowerCase());
  const mapping: CsvMapping = {};
  for (const field of CSV_FIELDS) {
    for (const alias of ALIASES[field]) {
      const index = lower.indexOf(alias);
      if (index !== -1) {
        mapping[field] = index;
        break;
      }
    }
  }
  return mapping;
}

const DOCUMENT_TYPES: Record<string, string> = {
  article: 'article-journal',
  review: 'article-journal',
  editorial: 'article-journal',
  letter: 'article-journal',
  note: 'article-journal',
  erratum: 'article-journal',
  'short survey': 'article-journal',
  'conference paper': 'paper-conference',
  'conference review': 'paper-conference',
  book: 'book',
  'book chapter': 'chapter',
};

/** Converts mapped CSV rows into records. Requires a title column. */
export function csvToRecords(table: CsvTable, mapping: CsvMapping): ParseResult {
  if (mapping.title === undefined) return { records: [], warnings: [{ code: 'csvNoTitleColumn' }] };
  const warnings: ImportWarning[] = [];
  const records = table.rows.map((row): ParsedRecord => {
    const cell = (field: CsvField) => {
      const index = mapping[field];
      return index === undefined ? undefined : row.cells[index]?.trim() || undefined;
    };
    const title = cleanText(cell('title'));
    if (!title) warnings.push({ code: 'missingTitle', line: row.line });
    const doiValue = cell('doi');
    const doi = normalizeDoi(doiValue);
    const pmid = normalizePmid(cell('pmid'));
    const authors = (cell('authors') ?? '')
      .split(';')
      .map((name) => parsePersonName(name.replace(/\s*\(\d+\)\s*$/, '')))
      .filter((name): name is CslName => name !== undefined);
    const type = DOCUMENT_TYPES[(cell('type') ?? 'article').toLowerCase()] ?? 'article-journal';

    const csl = compactCsl({
      type,
      title,
      author: authors,
      issued: parseIssued(cell('year')),
      'container-title': cleanText(cell('container')),
      volume: cell('volume'),
      issue: cell('issue'),
      page: cell('pages') ?? pages(cell('pageStart'), cell('pageEnd')),
      DOI: doi ? doiValue : undefined,
      PMID: pmid,
      ISSN: cell('issn'),
      URL: cell('url'),
      abstract: cleanText(cell('abstract')),
      keyword: cell('keywords'),
      language: cell('language'),
      publisher: cleanText(cell('publisher')),
    });
    const record: ParsedRecord = {
      csl,
      raw: Papa.unparse({ fields: table.headers, data: [row.cells] }, { newline: '\n' }),
      line: row.line,
    };
    if (doi) record.doi = doi;
    if (pmid) record.pmid = pmid;
    return record;
  });
  return { records, warnings };
}
