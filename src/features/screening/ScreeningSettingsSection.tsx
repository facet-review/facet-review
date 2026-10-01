import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/db';
import { saveScreeningSettings } from '../../db/screeningRepository';
import { parseTerms } from '../../domain/screening/highlight';
import type { Project, ScreeningSettings } from '../../domain/types';
import { nowIso } from '../../app/runtime';
import { TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import styles from './Screening.module.css';
import { useHighlightPreference } from './useHighlightPreference';
import { useShortcutPreference } from './useShortcuts';

/** Project settings (stored with the project) and per-browser preferences. */
export function ScreeningSettingsSection({ project }: { project: Project }) {
  const { t } = useTranslation();
  const settings = project.screening;
  const [include, setInclude] = useState(settings.highlights.include.join('\n'));
  const [exclude, setExclude] = useState(settings.highlights.exclude.join('\n'));
  // Optimistic: the stored value arrives via the live query a moment later.
  const [maybeToFullText, setMaybeToFullText] = useState(settings.maybeToFullText);
  const [shortcuts, setShortcuts] = useShortcutPreference();
  const [highlight, setHighlight] = useHighlightPreference();

  const save = (next: ScreeningSettings) => saveScreeningSettings(db, project.id, next, nowIso());
  const saveTerms = () => {
    const highlights = { include: parseTerms(include), exclude: parseTerms(exclude) };
    if (JSON.stringify(highlights) !== JSON.stringify(settings.highlights))
      void save({ ...settings, highlights });
  };

  return (
    <section aria-labelledby="screening-settings" className={styles.section}>
      <h2 id="screening-settings">{t('screening.settings.heading')}</h2>
      <div className={forms.section}>
        <label className={forms.radioOption}>
          <input
            type="checkbox"
            checked={maybeToFullText}
            onChange={(event) => {
              setMaybeToFullText(event.target.checked);
              void save({ ...settings, maybeToFullText: event.target.checked });
            }}
          />
          {t('screening.settings.maybeToFullText')}
        </label>
        <div className={forms.grid2}>
          <TextField
            id="highlight-include"
            label={t('screening.settings.includeTerms')}
            hint={t('screening.settings.termsHint')}
            multiline
            rows={4}
            value={include}
            onChange={setInclude}
            onBlur={saveTerms}
          />
          <TextField
            id="highlight-exclude"
            label={t('screening.settings.excludeTerms')}
            hint={t('screening.settings.termsHint')}
            multiline
            rows={4}
            value={exclude}
            onChange={setExclude}
            onBlur={saveTerms}
          />
        </div>
        <p className={forms.hint}>{t('screening.settings.deviceHint')}</p>
        <label className={forms.radioOption}>
          <input
            type="checkbox"
            checked={highlight}
            onChange={(event) => setHighlight(event.target.checked)}
          />
          {t('screening.settings.highlight')}
        </label>
        <label className={forms.radioOption}>
          <input
            type="checkbox"
            checked={shortcuts}
            onChange={(event) => setShortcuts(event.target.checked)}
          />
          {t('screening.settings.shortcuts')}
        </label>
      </div>
    </section>
  );
}
