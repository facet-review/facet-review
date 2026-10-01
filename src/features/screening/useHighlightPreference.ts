import { useState } from 'react';
import { readPreference, writePreference } from '../../app/preferences';

const KEY = 'screening.highlight';

export function useHighlightPreference() {
  const [enabled, setEnabled] = useState(() => readPreference(KEY) !== 'off');
  const change = (next: boolean) => {
    setEnabled(next);
    writePreference(KEY, next ? 'on' : 'off');
  };
  return [enabled, change] as const;
}
