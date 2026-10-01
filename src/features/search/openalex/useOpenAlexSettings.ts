import { useState } from 'react';
import { readPreference, writePreference } from '../../../app/preferences';
import type { OpenAlexCredentials } from '../../../domain/openalex/types';

const KEYS = { mailto: 'openalex.mailto', apiKey: 'openalex.apiKey' } as const;

/** E-mail address and API key for OpenAlex: per browser, never in a project or export. */
export function useOpenAlexSettings() {
  const [settings, setSettings] = useState<Required<OpenAlexCredentials>>(() => ({
    mailto: readPreference(KEYS.mailto) ?? '',
    apiKey: readPreference(KEYS.apiKey) ?? '',
  }));
  const update = (key: keyof typeof KEYS, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    writePreference(KEYS[key], value.trim());
  };
  return [settings, update] as const;
}
