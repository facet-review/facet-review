import type { DateOnly } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The local calendar day of a moment. A search run at 00:30 in Wels belongs to
 * that day, even though it is still the previous day in UTC.
 */
export function toLocalDateOnly(date: Date): DateOnly {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True for real calendar dates in strict YYYY-MM-DD form. */
export function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
