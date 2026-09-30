import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** Sets `<title>` to "<page> – Facet Review" in the current UI language. */
export function useDocumentTitle(pageTitle: string) {
  const { t } = useTranslation();
  const appName = t('app.name');
  useEffect(() => {
    document.title = `${pageTitle} – ${appName}`;
  }, [pageTitle, appName]);
}
