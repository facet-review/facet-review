import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/db';
import { updateSearchMeta } from '../../db/searchRepository';
import type { Project } from '../../domain/types';
import { nowIso } from '../../app/runtime';
import { FormSection, TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import { useAutosave } from '../project/useAutosave';

type MetaKey = keyof Project['searchMeta'];
const FIELDS: readonly MetaKey[] = ['filters', 'priorWork', 'updates', 'peerReview'];

/** PRISMA-S items 10, 11, 12 and 14 – saved automatically. */
export function SearchMetaSection({ project }: { project: Project }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(project.searchMeta);
  const save = useCallback(
    (meta: Project['searchMeta']) => updateSearchMeta(db, project.id, meta, nowIso()),
    [project.id],
  );
  const status = useAutosave(draft, save);

  return (
    <FormSection title={t('search.meta.heading')}>
      <p role="status" className={forms.hint}>
        {status === 'pending' && t('common.saving')}
        {status === 'saved' && t('common.saved')}
      </p>
      {FIELDS.map((key) => (
        <TextField
          key={key}
          label={t(`search.meta.${key}`)}
          hint={t(`search.meta.${key}Hint`)}
          value={draft[key] ?? ''}
          multiline
          rows={2}
          onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
    </FormSection>
  );
}
