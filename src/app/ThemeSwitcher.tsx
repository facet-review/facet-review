import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup } from '../design/ToggleGroup';
import { getStoredTheme, setTheme, THEMES, type Theme } from './theme';

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const options = THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }));
  return (
    <ToggleGroup
      label={t('settings.theme.label')}
      options={options}
      value={theme}
      onChange={(value) => {
        setTheme(value);
        setThemeState(value);
      }}
    />
  );
}
