import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { Footer } from './Footer';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import styles from './Layout.module.css';

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // Move focus to the main region after client-side navigation (not on first load),
  // so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      mainRef.current?.focus();
    }
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        {t('app.skipLink')}
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link to="/" className={styles.wordmark} aria-label={t('app.homeLink')}>
              {t('app.name')}
            </Link>
            <p className={styles.subtitle}>{t('app.subtitle')}</p>
          </div>
          <div className={styles.settings}>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
