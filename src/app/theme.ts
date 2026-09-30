import { readPreference, writePreference } from './preferences';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const THEME_KEY = 'theme';

function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function getStoredTheme(): Theme {
  const stored = readPreference(THEME_KEY);
  return isTheme(stored) ? stored : 'system';
}

/** `system` removes the attribute so that `prefers-color-scheme` decides. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  writePreference(THEME_KEY, theme);
}
