import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AUTHOR, CC_BY_4_URL, PRISMA_CITATIONS, SOURCE_CODE_URL } from './attribution';
import styles from './Footer.module.css';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.author}>
          {t('footer.authorPrefix')} <a href={AUTHOR.url}>{AUTHOR.name}</a>
        </p>

        <section aria-labelledby="footer-attribution" className={styles.attribution}>
          <h2 id="footer-attribution" className={styles.heading}>
            {t('footer.attributionHeading')}
          </h2>
          <ul className={styles.citations}>
            {PRISMA_CITATIONS.map((citation) => (
              <li key={citation.id} lang="en">
                {citation.text}{' '}
                <a href={`https://doi.org/${citation.doi}`}>{`doi:${citation.doi}`}</a>
              </li>
            ))}
          </ul>
          <p>
            <a href={CC_BY_4_URL}>{t('footer.attributionNote')}</a>
          </p>
        </section>

        <nav aria-label={t('footer.legalNav')} className={styles.legal}>
          <Link to="/impressum">{t('footer.imprint')}</Link>
          <Link to="/datenschutz">{t('footer.privacy')}</Link>
        </nav>

        <p className={styles.license}>
          {t('footer.license')} <a href={SOURCE_CODE_URL}>{t('footer.sourceCode')}</a>
        </p>
      </div>
    </footer>
  );
}
