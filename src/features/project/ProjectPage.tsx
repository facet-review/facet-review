import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/db';
import { saveProject } from '../../db/projectRepository';
import { validateProject } from '../../domain/project/validateProject';
import type { Project } from '../../domain/types';
import { PageHeading } from '../../app/PageHeading';
import { nowIso } from '../../app/runtime';
import { BasicsSection } from './sections/BasicsSection';
import { EligibilitySection } from './sections/EligibilitySection';
import { ExclusionReasonsSection } from './sections/ExclusionReasonsSection';
import { QuestionSection } from './sections/QuestionSection';
import { RegistrationSection } from './sections/RegistrationSection';
import { useAutosave } from './useAutosave';
import { useProject } from './useProject';
import styles from './ProjectPage.module.css';

export type UpdateProject = (change: (project: Project) => Project) => void;

/** Module 1: project, research question and criteria. */
export default function ProjectPage() {
  const project = useProject();
  // Re-mount per project so the draft starts from the stored state.
  return <ProjectEditor key={project.id} initial={project} />;
}

function ProjectEditor({ initial }: { initial: Project }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const save = useCallback((project: Project) => saveProject(db, project, nowIso()), []);
  const status = useAutosave(draft, save);
  const update: UpdateProject = useCallback((change) => setDraft((current) => change(current)), []);
  const issues = validateProject(draft);

  return (
    <>
      <PageHeading
        title={t('modules.project.title')}
        description={t('modules.project.description')}
      />
      <p role="status" className={styles.saveStatus}>
        {status === 'pending' && t('common.saving')}
        {status === 'saved' && t('common.saved')}
      </p>
      <BasicsSection project={draft} update={update} issues={issues} />
      <QuestionSection project={draft} update={update} />
      <EligibilitySection project={draft} update={update} />
      <ExclusionReasonsSection project={draft} update={update} />
      <RegistrationSection project={draft} update={update} issues={issues} />
    </>
  );
}
