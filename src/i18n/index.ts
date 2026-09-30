import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';
import en from './en.json';
import { readPreference, writePreference } from '../app/preferences';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'de';

/** Each language is named in itself (endonym), so it is recognisable regardless of the UI language. */
export const LANGUAGE_ENDONYMS: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
};

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

const LANGUAGE_KEY = 'language';

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

const stored = readPreference(LANGUAGE_KEY);
const initialLanguage: Language = isLanguage(stored) ? stored : DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language;
}

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  writePreference(LANGUAGE_KEY, language);
});

export default i18n;
