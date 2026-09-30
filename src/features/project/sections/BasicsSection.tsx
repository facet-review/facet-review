import { useTranslation } from 'react-i18next';
import { setAuthor } from '../../../domain/project/createProject';
import type { ProjectIssue } from '../../../domain/project/validateProject';
import type { Project } from '../../../domain/types';
import { newId } from '../../../app/runtime';
import forms from '../../../design/forms.module.css';
import { FormSection, RadioGroup, SelectField, TextField } from '../../../design/Field';
import { REVIEW_LANGUAGES } from '../defaults';
import type { UpdateProject } from '../ProjectPage';

interface Props {
  project: Project;
  update: UpdateProject;
  issues: ProjectIssue[];
}

export function BasicsSection({ project, update, issues }: Props) {
  const { t } = useTranslation();
  const titleMissing = issues.some((issue) => issue.field === 'title');
  const setMetadata = (key: 'institution' | 'language', value: string) =>
    update((p) => ({ ...p, metadata: { ...p.metadata, [key]: value } }));

  return (
    <FormSection title={t('project.sections.basics')}>
      <TextField
        label={t('project.fields.title')}
        value={project.title}
        required
        error={titleMissing ? t('validation.required') : undefined}
        onChange={(title) => update((p) => ({ ...p, title }))}
      />
      <div className={forms.grid2}>
        <TextField
          label={t('project.fields.author')}
          hint={t('project.fields.authorHint')}
          value={project.metadata.author}
          autoComplete="name"
          onChange={(name) => update((p) => setAuthor(p, name, newId))}
        />
        <TextField
          label={t('project.fields.institution')}
          value={project.metadata.institution}
          autoComplete="organization"
          onChange={(value) => setMetadata('institution', value)}
        />
      </div>
      <SelectField
        label={t('project.fields.language')}
        value={project.metadata.language}
        options={REVIEW_LANGUAGES.map((code) => ({
          value: code,
          label: t(`reviewLanguages.${code}`),
        }))}
        onChange={(value) => setMetadata('language', value)}
      />
      <RadioGroup
        legend={t('project.fields.reviewType')}
        hint={t('project.fields.reviewTypeHint')}
        value={project.reviewType}
        options={[
          { value: 'new', label: t('reviewType.new') },
          { value: 'update', label: t('reviewType.update') },
        ]}
        onChange={(reviewType) => update((p) => ({ ...p, reviewType }))}
      />
    </FormSection>
  );
}
