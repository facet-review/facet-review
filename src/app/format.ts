/** Locale-aware date/time for display (e.g. "30.09.2026, 14:05"). */
export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
