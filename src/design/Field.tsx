import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './forms.module.css';

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function describedBy(...ids: (string | false | undefined)[]) {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  children,
}: BaseFieldProps & { id: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.requiredMark}> ({t('common.required')})</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Stable id, e.g. as jump target of an error summary. */
  id?: string;
  type?: 'text' | 'url' | 'date';
  /** `numeric` shows a number keyboard without the pitfalls of type="number". */
  inputMode?: 'numeric';
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
  /** Monospace, no spell check, whitespace kept – for search strategies. */
  code?: boolean;
  /** id of a <datalist> with suggestions. */
  list?: string;
  disabled?: boolean;
}

export function TextField({
  value,
  onChange,
  id: fixedId,
  type = 'text',
  inputMode,
  multiline = false,
  rows = 3,
  autoComplete = 'off',
  code = false,
  list,
  disabled,
  ...frame
}: TextFieldProps) {
  const generatedId = useId();
  const id = fixedId ?? generatedId;
  const common = {
    id,
    value,
    className: code ? `${styles.input} ${styles.code}` : styles.input,
    spellCheck: code ? false : undefined,
    disabled,
    required: frame.required,
    'aria-invalid': frame.error ? true : undefined,
    'aria-describedby': describedBy(frame.hint && `${id}-hint`, frame.error && `${id}-error`),
  };
  return (
    <FieldFrame id={id} {...frame}>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={type}
          inputMode={inputMode}
          list={list}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldFrame>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> extends BaseFieldProps {
  id?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  id: fixedId,
  value,
  options,
  onChange,
  ...frame
}: SelectFieldProps<T>) {
  const generatedId = useId();
  const id = fixedId ?? generatedId;
  return (
    <FieldFrame id={id} {...frame}>
      <select
        id={id}
        value={value}
        className={styles.input}
        aria-describedby={describedBy(frame.hint && `${id}-hint`)}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

interface RadioGroupProps<T extends string> {
  legend: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** id of the first radio button, e.g. as jump target of an error summary. */
  id?: string;
  value: T | '';
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

export function RadioGroup<T extends string>({
  legend,
  hint,
  error,
  required,
  id,
  value,
  options,
  onChange,
}: RadioGroupProps<T>) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset
      className={styles.fieldset}
      aria-describedby={describedBy(hint && `${name}-hint`, error && `${name}-error`)}
    >
      <legend className={styles.legend}>
        {legend}
        {required && <span className={styles.requiredMark}> ({t('common.required')})</span>}
      </legend>
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className={styles.error}>
          {error}
        </p>
      )}
      {options.map((option, index) => (
        <label key={option.value} className={styles.radioOption}>
          <input
            id={index === 0 ? id : undefined}
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/** A form section with its own h2, labelled for assistive technology. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionHeading}>
        {title}
      </h2>
      {children}
    </section>
  );
}
