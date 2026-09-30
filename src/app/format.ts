/** Locale-aware date/time for display (e.g. "30.09.2026, 14:05"). */
export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Calendar date (YYYY-MM-DD) for display, without time-zone shifts. */
export function formatDate(dateOnly: string, language: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(
    new Date(year, month - 1, day),
  );
}

export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}
