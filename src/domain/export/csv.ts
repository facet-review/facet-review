export type CsvDelimiter = ';' | ',' | '\t';
export const CSV_DELIMITERS: readonly CsvDelimiter[] = [';', ',', '\t'];

/** German Excel expects semicolons when a CSV is opened by double-click. */
export function defaultDelimiter(language: string): CsvDelimiter {
  return language.toLowerCase().startsWith('de') ? ';' : ',';
}

/**
 * Cells starting with = + @ would be evaluated as formulas by spreadsheet
 * programs (CSV injection); a leading apostrophe keeps them text. A leading
 * minus stays: negative numbers and hyphenated text are common in data.
 */
function cell(value: string): string {
  const safe = /^[=+@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * CSV as spreadsheet programs open it by double-click: UTF-8 with BOM, every
 * cell quoted, CRLF line ends (RFC 4180), delimiter by choice.
 */
export function toCsv(rows: readonly (readonly string[])[], delimiter: CsvDelimiter): string {
  return `\uFEFF${rows.map((row) => row.map(cell).join(delimiter) + '\r\n').join('')}`;
}
