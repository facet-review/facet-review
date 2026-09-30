import { useTranslation } from 'react-i18next';
import type { Project } from '../../../domain/types';
import { moveItem, removeAt, updateAt } from '../../../domain/util/list';
import { EditableList } from '../../../design/EditableList';
import { FormSection } from '../../../design/Field';
import forms from '../../../design/forms.module.css';
import type { UpdateProject } from '../ProjectPage';

interface Props {
  project: Project;
  update: UpdateProject;
}

type Kind = keyof Project['eligibility'];

export function EligibilitySection({ project, update }: Props) {
  const { t } = useTranslation();
  return (
    <FormSection title={t('project.sections.eligibility')}>
      <p className={forms.hint}>{t('project.fields.eligibilityHint')}</p>
      <CriteriaList kind="inclusion" project={project} update={update} />
      <CriteriaList kind="exclusion" project={project} update={update} />
    </FormSection>
  );
}

function CriteriaList({ kind, project, update }: Props & { kind: Kind }) {
  const { t } = useTranslation();
  const change = (next: (list: string[]) => string[]) =>
    update((p) => ({ ...p, eligibility: { ...p.eligibility, [kind]: next(p.eligibility[kind]) } }));
  const labels =
    kind === 'inclusion'
      ? {
          label: t('project.fields.inclusion'),
          item: (n: number) => t('project.fields.inclusionItem', { n }),
          add: t('project.fields.addInclusion'),
        }
      : {
          label: t('project.fields.exclusion'),
          item: (n: number) => t('project.fields.exclusionItem', { n }),
          add: t('project.fields.addExclusion'),
        };

  return (
    <EditableList
      label={labels.label}
      items={project.eligibility[kind].map((value, index) => ({ key: String(index), value }))}
      itemLabel={labels.item}
      addLabel={labels.add}
      onChange={(index, value) => change((list) => updateAt(list, index, value))}
      onAdd={() => change((list) => [...list, ''])}
      onRemove={(index) => change((list) => removeAt(list, index))}
      onMove={(index, direction) => change((list) => moveItem(list, index, index + direction))}
    />
  );
}
