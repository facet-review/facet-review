import { useTranslation } from 'react-i18next';
import type { DedupResult } from '../../domain/dedup/dedup';
import { formatNumber } from '../../app/format';
import styles from './Import.module.css';

/** Counts of the deduplication – "duplicates removed" feeds the flow diagram (milestone 5). */
export function DedupSummary({ result }: { result: DedupResult | undefined }) {
  const { t, i18n } = useTranslation();
  if (!result) return <p role="status">{t('dedupStats.computing')}</p>;
  const automatic = result.groups.filter((group) => !group.confirmedAt).length;
  const confirmed = result.groups.length - automatic;
  const number = (value: number) => formatNumber(value, i18n.language);
  const items: [string, number][] = [
    [t('dedupStats.records'), result.stats.records],
    [t('dedupStats.automatic'), automatic],
    [t('dedupStats.confirmed'), confirmed],
    [t('dedupStats.open'), result.stats.openCandidates],
    [t('dedupStats.separated'), result.stats.separatedPairs],
    [t('dedupStats.removed'), result.stats.duplicatesRemoved],
    [t('dedupStats.unique'), result.stats.unique],
  ];
  return (
    <dl className={styles.stats}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{number(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
