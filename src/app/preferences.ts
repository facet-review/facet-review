/**
 * Per-browser UI preferences (language, theme). Stored in localStorage only –
 * no cookies, never transmitted. Access is guarded because storage can be
 * unavailable (private mode, blocked site data).
 */
const PREFIX = 'facet-review.';

export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Preference is simply not remembered.
  }
}
