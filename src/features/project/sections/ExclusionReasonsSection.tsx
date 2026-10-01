import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../../db/db';
import {
  addReason,
  moveReason,
  removeReason,
  renameReason,
  sortedReasons,
} from '../../../domain/project/exclusionReasons';
import type { Project } from '../../../domain/types';
import { newId } from '../../../app/runtime';
import { EditableList } from '../../../design/EditableList';
import { FormSection } from '../../../design/Field';
import type { UpdateProject } from '../ProjectPage';

interface Props {
  project: Project;
  update: UpdateProject;
}

export function ExclusionReasonsSection({ project, update }: Props) {
  const { t } = useTranslation();
  const reasons = sortedReasons(project.exclusionReasons);
  const change = (next: (r: Project['exclusionReasons']) => Project['exclusionReasons']) =>
    update((p) => ({ ...p, exclusionReasons: next(p.exclusionReasons) }));
  const idAt = (index: number) => reasons[index]?.id ?? '';
  // Reasons used by decisions stay (audit trail); renaming is still possible.
  const used = useLiveQuery(async () => {
    const decisions = await db.decisions.where('projectId').equals(project.id).toArray();
    return new Set(decisions.map((d) => d.reasonId).filter(Boolean));
  }, [project.id]);

  return (
    <FormSection title={t('project.sections.exclusionReasons')}>
      <EditableList
        label={t('project.sections.exclusionReasons')}
        hideLabel
        hint={t('project.fields.reasonsHint')}
        items={reasons.map((reason) => ({ key: reason.id, value: reason.label }))}
        itemLabel={(n) => t('project.fields.reasonItem', { n })}
        addLabel={t('project.fields.addReason')}
        onChange={(index, label) => change((r) => renameReason(r, idAt(index), label))}
        onAdd={() => change((r) => addReason(r, '', newId))}
        onRemove={(index) => change((r) => removeReason(r, idAt(index)))}
        onMove={(index, direction) => change((r) => moveReason(r, idAt(index), direction))}
        removeBlocked={(index) =>
          used?.has(idAt(index)) ? t('project.fields.reasonInUse') : undefined
        }
      />
    </FormSection>
  );
}
