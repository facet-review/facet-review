import { useTranslation } from 'react-i18next';
import { MODULES, type ModuleKey } from './modules';
import { PageHeading } from './PageHeading';
import styles from './ModulePlaceholder.module.css';

/** Temporary page for modules that are not built yet. */
export function ModulePlaceholder({ module }: { module: ModuleKey }) {
  const { t } = useTranslation();
  const milestone = MODULES.find((entry) => entry.key === module)?.milestone;
  return (
    <>
      <PageHeading
        title={t(`modules.${module}.title`)}
        description={t(`modules.${module}.description`)}
      />
      <p className={styles.notice}>{t('pages.placeholder', { milestone })}</p>
    </>
  );
}
