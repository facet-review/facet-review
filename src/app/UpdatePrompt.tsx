import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import button from '../design/button.module.css';
import notice from '../design/notice.module.css';
import styles from './Layout.module.css';

/**
 * Registers the service worker (offline use, PRD §6) and announces updates.
 * A new version is never activated unasked – not in the middle of screening.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const message = needRefresh ? t('pwa.update') : offlineReady ? t('pwa.offlineReady') : '';
  // Rendered only when needed: a permanent second status region would compete
  // with the status messages of the pages.
  if (!message) return null;
  return (
    <div role="status" className={styles.banner}>
      <div className={`${notice.notice} ${styles.bannerInner}`}>
        <p>{message}</p>
        {needRefresh && (
          <button
            type="button"
            className={`${button.button} ${button.primary} ${button.small}`}
            onClick={() => void updateServiceWorker(true)}
          >
            {t('pwa.reload')}
          </button>
        )}
        <button
          type="button"
          className={`${button.button} ${button.small}`}
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          {needRefresh ? t('pwa.later') : t('pwa.dismiss')}
        </button>
      </div>
    </div>
  );
}
