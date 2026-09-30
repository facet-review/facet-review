import type { TFunction } from 'i18next';

const DEFAULT_REASON_KEYS = [
  'population',
  'intervention',
  'studyDesign',
  'outcome',
  'publicationType',
  'language',
  'timeframe',
] as const;

/** Default exclusion reasons in the current UI language; stored as user data on creation. */
export function defaultReasonLabels(t: TFunction): string[] {
  return DEFAULT_REASON_KEYS.map((key) => t(`defaults.exclusionReasons.${key}`));
}

export const REVIEW_LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'other'] as const;
