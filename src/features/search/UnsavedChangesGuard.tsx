import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '../../design/ConfirmDialog';

/**
 * Asks before leaving a form with unsaved changes – within the app (router
 * blocker) and when closing or reloading the tab (beforeunload).
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useTranslation();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('form.unsavedTitle')}
      onCancel={() => blocker.reset?.()}
      actions={[
        { label: t('form.discard'), variant: 'danger', onSelect: () => blocker.proceed?.() },
      ]}
    >
      <p>{t('form.unsavedBody')}</p>
    </ConfirmDialog>
  );
}
