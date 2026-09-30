import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeading } from './PageHeading';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeading
        title={t('pages.notFound.title')}
        description={t('pages.notFound.description')}
      />
      <p>
        <Link to="/">{t('pages.notFound.backHome')}</Link>
      </p>
    </>
  );
}
