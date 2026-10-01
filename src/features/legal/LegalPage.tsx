import { useTranslation } from 'react-i18next';
import { SOURCE_CODE_URL } from '../../app/attribution';
import { PageHeading } from '../../app/PageHeading';
import notice from '../../design/notice.module.css';
import styles from './Legal.module.css';

export const GITHUB_PRIVACY_URL =
  'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement';

/** Section order per page; the texts live in i18n under legal.<page>.sections.<key>. */
const SECTIONS = {
  imprint: ['owner', 'purpose', 'license', 'attribution'],
  privacy: [
    'controller',
    'local',
    'hosting',
    'openalex',
    'links',
    'csp',
    'deletion',
    'rights',
    'updated',
  ],
} as const;

/** Links shown below a section's text. */
const LINKS: Partial<Record<string, string>> = {
  hosting: GITHUB_PRIVACY_URL,
  license: SOURCE_CODE_URL,
};

const PLACEHOLDER = /\[(PLATZHALTER|PLACEHOLDER)\b/;

/**
 * Legal notice and privacy policy. The author supplies the final texts; until
 * then, placeholders are marked and a draft notice is shown automatically.
 */
export default function LegalPage({ page }: { page: keyof typeof SECTIONS }) {
  const { t } = useTranslation();
  const sections = SECTIONS[page].map((key) => ({
    key,
    heading: t(`legal.${page}.sections.${key}.heading` as 'legal.imprint.title'),
    body: t(`legal.${page}.sections.${key}.body` as 'legal.imprint.title'),
    link: LINKS[key],
  }));
  const draft = sections.some((section) => PLACEHOLDER.test(section.body));

  return (
    <>
      <PageHeading title={t(`legal.${page}.title`)} description={t(`legal.${page}.description`)} />
      {draft && (
        <p className={`${notice.notice} ${notice.warning}`}>{t('legal.placeholderNotice')}</p>
      )}
      {sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`legal-${section.key}`}
          className={styles.section}
        >
          <h2 id={`legal-${section.key}`}>{section.heading}</h2>
          {section.body.split('\n\n').map((paragraph, index) => (
            <p key={index} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}
          {section.link && (
            <p>
              <a href={section.link}>
                {section.key === 'hosting'
                  ? t('legal.privacy.sections.hosting.link')
                  : t('footer.sourceCode')}
              </a>
            </p>
          )}
        </section>
      ))}
    </>
  );
}
