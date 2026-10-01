import type { TFunction } from 'i18next';
import type { SuggestionKey } from '../../domain/checklist/suggestions';
import type { ExportLabelKey } from '../../domain/export/labels';
import type { AppendixLabelKey } from '../../domain/export/searchAppendix';

/*
 * Domain functions get their texts as plain functions; the strings live in
 * the i18n files. A fixed `t` (i18n.getFixedT) allows exports in a language
 * other than the UI.
 */
type AnyT = TFunction | ((key: string, options?: Record<string, unknown>) => string);
const call = (t: AnyT, key: string, vars?: Record<string, unknown>) =>
  (t as (key: string, options?: Record<string, unknown>) => string)(key, vars);

export const exportLabels = (t: AnyT) => (key: ExportLabelKey) => call(t, `export.labels.${key}`);
export const appendixLabels = (t: AnyT) => (key: AppendixLabelKey) =>
  call(t, `export.appendix.${key}`);
export const suggestionLabels =
  (t: AnyT) => (key: SuggestionKey, vars?: Record<string, string | number>) =>
    call(t, `checklist.suggestion.${key}`, vars);
