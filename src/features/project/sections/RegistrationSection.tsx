import { useTranslation } from 'react-i18next';
import type { ProjectIssue } from '../../../domain/project/validateProject';
import type { Project } from '../../../domain/types';
import forms from '../../../design/forms.module.css';
import { FormSection, TextField } from '../../../design/Field';
import type { UpdateProject } from '../ProjectPage';

interface Props {
  project: Project;
  update: UpdateProject;
  issues: ProjectIssue[];
}

type RegistrationKey = keyof Project['registration'];

export function RegistrationSection({ project, update, issues }: Props) {
  const { t } = useTranslation();
  const set = (key: RegistrationKey) => (value: string) =>
    update((p) => ({ ...p, registration: { ...p.registration, [key]: value } }));
  const urlError = (key: 'url' | 'protocolUrl') =>
    issues.some((issue) => issue.field === `registration.${key}`)
      ? t('validation.invalidUrl')
      : undefined;

  return (
    <FormSection title={t('project.sections.registration')}>
      <div className={forms.grid2}>
        <TextField
          label={t('project.fields.registry')}
          hint={t('project.fields.registryHint')}
          value={project.registration.registry}
          onChange={set('registry')}
        />
        <TextField
          label={t('project.fields.registrationId')}
          value={project.registration.id}
          onChange={set('id')}
        />
      </div>
      <TextField
        label={t('project.fields.registrationUrl')}
        hint={t('project.fields.urlHint')}
        type="url"
        value={project.registration.url}
        error={urlError('url')}
        onChange={set('url')}
      />
      <TextField
        label={t('project.fields.protocolUrl')}
        hint={`${t('project.fields.protocolUrlHint')} · ${t('project.fields.urlHint')}`}
        type="url"
        value={project.registration.protocolUrl}
        error={urlError('protocolUrl')}
        onChange={set('protocolUrl')}
      />
    </FormSection>
  );
}
