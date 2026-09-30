import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { db } from '../../db/db';
import { getProject } from '../../db/projectRepository';
import { MODULES, projectPath } from '../../app/modules';
import NotFoundPage from '../../app/NotFoundPage';
import styles from './ProjectLayout.module.css';

/** Frame for everything inside one project: breadcrumb, module navigation, module page. */
export default function ProjectLayout() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  // undefined = still loading, null = no such project
  const project = useLiveQuery(async () => (await getProject(db, projectId)) ?? null, [projectId]);

  if (project === undefined) {
    return <p role="status">{t('common.loading')}</p>;
  }
  if (project === null) {
    return <NotFoundPage />;
  }

  return (
    <div className={styles.frame}>
      <nav aria-label={t('nav.breadcrumb')}>
        <ol className={styles.breadcrumb}>
          <li>
            <Link to="/">{t('pages.overview.title')}</Link>
          </li>
          <li aria-current="page">{project.title || t('project.untitled')}</li>
        </ol>
      </nav>
      <nav aria-label={t('nav.label')} className={styles.nav}>
        <ol className={styles.navList}>
          {MODULES.map((module) => (
            <li key={module.key}>
              <NavLink to={projectPath(project.id, module.key)} className={styles.navLink}>
                {t(`modules.${module.key}.title`)}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      <Outlet context={project} />
    </div>
  );
}
