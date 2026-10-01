import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readPreference, writePreference } from '../../app/preferences';
import { CSV_DELIMITERS, defaultDelimiter, type CsvDelimiter } from '../../domain/export/csv';

const KEY = 'csv.delimiter';

/**
 * Delimiter of CSV exports, per browser. Until chosen it follows the UI
 * language: semicolon for German (Excel opens it by double-click), comma else.
 */
export function useCsvDelimiter() {
  const { i18n } = useTranslation();
  const [stored, setStored] = useState(() => {
    const value = readPreference(KEY);
    return CSV_DELIMITERS.find((d) => d === value);
  });
  const delimiter: CsvDelimiter = stored ?? defaultDelimiter(i18n.language);
  const change = (next: CsvDelimiter) => {
    setStored(next);
    writePreference(KEY, next);
  };
  return [delimiter, change] as const;
}
