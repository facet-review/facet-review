import { useTranslation } from 'react-i18next';
import type { StageStatus } from '../../domain/screening/status';
import styles from './Screening.module.css';

/** Short status text of a unit in one stage (list and detail view). */
export function StatusLabel({ status }: { status: StageStatus }) {
  const { t } = useTranslation();
  if (status.state === 'conflict')
    return <span className={styles.statusConflict}>{t('screening.filter.conflict')}</span>;
  if (status.state === 'open')
    return (
      <span className={styles.statusOpen}>
        {status.suggestion ? t('screening.filter.review') : t('screening.filter.open')}
      </span>
    );
  return <span>{t(`screening.value.${status.decision!.value}`)}</span>;
}
