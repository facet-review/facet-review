import { useId } from 'react';
import styles from './ToggleGroup.module.css';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  /** Language of the label, if it differs from the page language (e.g. endonyms). */
  lang?: string;
}

interface ToggleGroupProps<T extends string> {
  label: string;
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A labelled group of mutually exclusive toggle buttons (aria-pressed). */
export function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ToggleGroupProps<T>) {
  const labelId = useId();
  return (
    <div className={styles.root}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className={styles.group}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={option.value === value}
            className={styles.button}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
