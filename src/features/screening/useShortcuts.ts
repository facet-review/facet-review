import { useEffect, useRef, useState } from 'react';
import { readPreference, writePreference } from '../../app/preferences';

const KEY = 'screening.shortcuts';

/** WCAG 2.1.4: single-key shortcuts can be turned off (per browser, like the theme). */
export function useShortcutPreference() {
  const [enabled, setEnabled] = useState(() => readPreference(KEY) !== 'off');
  const change = (next: boolean) => {
    setEnabled(next);
    writePreference(KEY, next ? 'on' : 'off');
  };
  return [enabled, change] as const;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Single-key shortcuts for the screening view. Never fire while typing, with
 * modifier keys or while a modal dialog is open. Keys are matched
 * case-insensitively (`i`, `ArrowLeft`, …).
 */
export function useShortcuts(handlers: Record<string, () => void>, enabled: boolean) {
  const current = useRef(handlers);
  useEffect(() => {
    current.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event.target) || document.querySelector('dialog[open]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = current.current[key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
