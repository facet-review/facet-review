import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../app/PageHeading';

export default function ProjectsOverviewPage() {
  const { t } = useTranslation();
  return (
    <PageHeading title={t('pages.overview.title')} description={t('pages.overview.description')} />
  );
}
