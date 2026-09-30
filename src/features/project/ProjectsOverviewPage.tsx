import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { deleteProject, listProjects } from '../../db/projectRepository';
import { needsBackupReminder } from '../../domain/project/backupReminder';
import type { Project } from '../../domain/types';
import { formatDateTime } from '../../app/format';
import { projectPath } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import notice from '../../design/notice.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';
import { ImportProject } from './ImportProject';
import { exportProject } from './projectFileIO';
import styles from './ProjectsOverviewPage.module.css';

export default function ProjectsOverviewPage() {
  const { t, i18n } = useTranslation();
  const projects = useLiveQuery(() => listProjects(db), []);
  const [toDelete, setToDelete] = useState<Project>();
  const [status, setStatus] = useState('');
  const [now] = useState(nowIso);

  const titleOf = (project: Project) => project.title || t('project.untitled');

  return (
    <>
      <PageHeading
        title={t('pages.overview.title')}
        description={t('pages.overview.description')}
      />

      <div className={styles.actions}>
        <Link to="/projects/new" className={`${button.button} ${button.primary}`}>
          {t('overview.newProject')}
        </Link>
        <ImportProject onImported={(title) => setStatus(t('importFile.success', { title }))} />
      </div>

      <p role="status" className={styles.status}>
        {status}
      </p>

      <h2 className={styles.listHeading}>{t('overview.listHeading')}</h2>
      {projects === undefined ? (
        <p>{t('common.loading')}</p>
      ) : projects.length === 0 ? (
        <p>{t('overview.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {projects.map((project) => (
            <li key={project.id} className={styles.card}>
              <h3 className={styles.cardTitle}>
                <Link to={projectPath(project.id)}>{titleOf(project)}</Link>
              </h3>
              <dl className={styles.meta}>
                <div>
                  <dt>{t('overview.reviewType')}</dt>
                  <dd>{t(`reviewType.${project.reviewType}`)}</dd>
                </div>
                <div>
                  <dt>{t('overview.updatedAt')}</dt>
                  <dd>{formatDateTime(project.updatedAt, i18n.language)}</dd>
                </div>
                <div>
                  <dt>{t('overview.lastExport')}</dt>
                  <dd>
                    {project.backup.lastExportedAt
                      ? formatDateTime(project.backup.lastExportedAt, i18n.language)
                      : t('overview.neverExported')}
                  </dd>
                </div>
              </dl>
              {needsBackupReminder(project, now) && (
                <p className={`${notice.notice} ${notice.warning}`}>
                  {t('overview.backupReminder')}
                </p>
              )}
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={`${button.button} ${button.small}`}
                  onClick={() =>
                    void exportProject(project.id).then(() =>
                      setStatus(t('overview.exported', { title: titleOf(project) })),
                    )
                  }
                >
                  {t('overview.export')}
                  <span className="visually-hidden">{` – ${titleOf(project)}`}</span>
                </button>
                <button
                  type="button"
                  className={`${button.button} ${button.small} ${button.danger}`}
                  onClick={() => setToDelete(project)}
                >
                  {t('overview.delete')}
                  <span className="visually-hidden">{` – ${titleOf(project)}`}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== undefined}
        title={t('overview.deleteTitle')}
        onCancel={() => setToDelete(undefined)}
        actions={[
          {
            label: t('overview.deleteConfirm'),
            variant: 'danger',
            onSelect: () => {
              if (!toDelete) return;
              const title = titleOf(toDelete);
              setToDelete(undefined);
              void deleteProject(db, toDelete.id).then(() =>
                setStatus(t('overview.deleted', { title })),
              );
            },
          },
        ]}
      >
        <p>{t('overview.deleteBody', { title: toDelete ? titleOf(toDelete) : '' })}</p>
      </ConfirmDialog>
    </>
  );
}
