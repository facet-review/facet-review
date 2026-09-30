import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { db } from '../../db/db';
import { requestPersistentStorage } from '../../db/persistence';
import { addProject } from '../../db/projectRepository';
import { createProject } from '../../domain/project/createProject';
import { validateProject } from '../../domain/project/validateProject';
import type { ReviewType } from '../../domain/types';
import { projectPath } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { newId, nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import forms from '../../design/forms.module.css';
import { RadioGroup, TextField } from '../../design/Field';
import { defaultReasonLabels, REVIEW_LANGUAGES } from './defaults';

export default function NewProjectPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [reviewType, setReviewType] = useState<ReviewType>('new');
  const [titleError, setTitleError] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const uiLanguage = i18n.resolvedLanguage ?? 'de';
    const project = createProject(
      {
        title,
        reviewType,
        author: author.trim(),
        language: (REVIEW_LANGUAGES as readonly string[]).includes(uiLanguage) ? uiLanguage : 'de',
      },
      { newId, now: nowIso, defaultReasonLabels: defaultReasonLabels(t) },
    );
    if (validateProject(project).some((issue) => issue.field === 'title')) {
      setTitleError(true);
      return;
    }
    await addProject(db, project);
    await requestPersistentStorage();
    void navigate(projectPath(project.id));
  }

  return (
    <>
      <PageHeading title={t('newProject.title')} description={t('newProject.description')} />
      <form className={forms.section} noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          label={t('project.fields.title')}
          value={title}
          required
          error={titleError ? t('validation.required') : undefined}
          onChange={(value) => {
            setTitle(value);
            if (titleError && value.trim()) setTitleError(false);
          }}
        />
        <TextField
          label={t('project.fields.author')}
          hint={t('project.fields.authorHint')}
          value={author}
          autoComplete="name"
          onChange={setAuthor}
        />
        <RadioGroup
          legend={t('project.fields.reviewType')}
          hint={t('project.fields.reviewTypeHint')}
          value={reviewType}
          options={[
            { value: 'new', label: t('reviewType.new') },
            { value: 'update', label: t('reviewType.update') },
          ]}
          onChange={setReviewType}
        />
        <div>
          <button type="submit" className={`${button.button} ${button.primary}`}>
            {t('newProject.submit')}
          </button>
        </div>
      </form>
    </>
  );
}
