import { useTranslation } from 'react-i18next';
import { ToggleGroup } from '../design/ToggleGroup';
import { LANGUAGE_ENDONYMS, SUPPORTED_LANGUAGES, type Language } from '../i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const options = SUPPORTED_LANGUAGES.map((language) => ({
    value: language,
    label: LANGUAGE_ENDONYMS[language],
    lang: language,
  }));
  return (
    <ToggleGroup
      label={t('settings.language.label')}
      options={options}
      value={i18n.resolvedLanguage as Language}
      onChange={(language) => void i18n.changeLanguage(language)}
    />
  );
}
