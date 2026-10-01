import type { CslItem } from '../types';
import { decodeEntities } from './normalize';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Publication date from the many export styles: "2022", "2026/04//",
 * "2025 Mar 26", "Apr 2026", "2021-01-26". Only plausible years are accepted.
 */
export function parseIssued(value: string | undefined): CslItem['issued'] | undefined {
  if (!value) return undefined;
  const year = value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1];
  if (!year) return undefined;
  const parts: number[] = [Number(year)];
  const numeric = value.match(/\b\d{4}[/-](\d{1,2})(?:[/-](\d{1,2}))?/);
  const named = value
    .toLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{1,2})\b)?/);
  const month = numeric?.[1] ? Number(numeric[1]) : named ? MONTHS.indexOf(named[1]!) + 1 : 0;
  if (month >= 1 && month <= 12) {
    parts.push(month);
    const day = Number(numeric?.[2] ?? named?.[2] ?? 0);
    if (day >= 1 && day <= 31) parts.push(day);
  }
  return { 'date-parts': [parts] };
}

/** Prefers the most precise of several date fields. */
export function mostPrecise(...values: (string | undefined)[]): CslItem['issued'] | undefined {
  let best: CslItem['issued'] | undefined;
  for (const value of values) {
    const issued = parseIssued(value);
    const length = issued?.['date-parts']?.[0]?.length ?? 0;
    if (length > (best?.['date-parts']?.[0]?.length ?? 0)) best = issued;
  }
  return best;
}

/** Entities decoded, whitespace collapsed; undefined when empty. */
export function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text || undefined;
}

/** Builds a CSL item, leaving out empty fields. */
export function compactCsl(fields: CslItem): CslItem {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) =>
        value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
    ),
  ) as CslItem;
}

export function pages(start: string | undefined, end: string | undefined): string | undefined {
  if (start && end && start !== end) return `${start}-${end}`;
  return start || end || undefined;
}
