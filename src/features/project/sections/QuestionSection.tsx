import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FRAMEWORK_FIELDS, FRAMEWORKS, switchFramework } from '../../../domain/project/frameworks';
import type { Project, QuestionFramework } from '../../../domain/types';
import { ConfirmDialog } from '../../../design/ConfirmDialog';
import { FormSection, SelectField, TextField } from '../../../design/Field';
import type { UpdateProject } from '../ProjectPage';

type FieldKey = (typeof FRAMEWORK_FIELDS)[QuestionFramework][number];

interface Props {
  project: Project;
  update: UpdateProject;
}

export function QuestionSection({ project, update }: Props) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ framework: QuestionFramework; discarded: string[] }>();
  const { question } = project;
  const fieldLabel = (key: string) =>
    t(`frameworkFields.${key as FieldKey}` as 'frameworkFields.population');

  function chooseFramework(framework: QuestionFramework) {
    const result = switchFramework(question, framework);
    if (result.discarded.length > 0) {
      setPending({ framework, discarded: result.discarded });
    } else {
      update((p) => ({ ...p, question: result.question }));
    }
  }

  return (
    <FormSection title={t('project.sections.question')}>
      <TextField
        label={t('project.fields.questionText')}
        value={question.text}
        multiline
        rows={3}
        onChange={(text) => update((p) => ({ ...p, question: { ...p.question, text } }))}
      />
      <SelectField
        label={t('project.fields.framework')}
        hint={t('project.fields.frameworkHint')}
        value={question.framework}
        options={FRAMEWORKS.map((framework) => ({
          value: framework,
          label: t(`frameworks.${framework}`),
        }))}
        onChange={chooseFramework}
      />
      {FRAMEWORK_FIELDS[question.framework].map((key) => (
        <TextField
          key={key}
          label={fieldLabel(key)}
          value={question.fields[key] ?? ''}
          multiline
          rows={2}
          onChange={(value) =>
            update((p) => ({
              ...p,
              question: { ...p.question, fields: { ...p.question.fields, [key]: value } },
            }))
          }
        />
      ))}
      <ConfirmDialog
        open={pending !== undefined}
        title={t('project.frameworkDiscardTitle')}
        onCancel={() => setPending(undefined)}
        actions={[
          {
            label: t('project.frameworkDiscardConfirm'),
            variant: 'danger',
            onSelect: () => {
              if (!pending) return;
              const { framework } = pending;
              setPending(undefined);
              update((p) => ({ ...p, question: switchFramework(p.question, framework).question }));
            },
          },
        ]}
      >
        <p>
          {t('project.frameworkDiscardBody', {
            fields: (pending?.discarded ?? []).map(fieldLabel).join(', '),
          })}
        </p>
      </ConfirmDialog>
    </FormSection>
  );
}
