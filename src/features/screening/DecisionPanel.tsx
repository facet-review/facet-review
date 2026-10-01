import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import button from '../../design/button.module.css';
import forms from '../../design/forms.module.css';
import { sortedReasons } from '../../domain/project/exclusionReasons';
import type { DecisionInput } from '../../domain/screening/decide';
import type { ExclusionReason, ScreeningStage } from '../../domain/types';
import styles from './Screening.module.css';
import { useShortcuts } from './useShortcuts';

interface Props {
  stage: ScreeningStage;
  reasons: readonly ExclusionReason[];
  /** No decisions possible (unit not in this stage, stage locked). */
  disabled: boolean;
  shortcuts: boolean;
  onDecide: (input: DecisionInput) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUndo?: () => void;
}

type Mode = 'idle' | 'reason' | 'notRetrieved';

/** aria-keyshortcuts value and the visible key hint. */
const KEYS = {
  include: { key: 'I', hint: 'I' },
  exclude: { key: 'E', hint: 'E' },
  maybe: { key: 'M', hint: 'M' },
  notRetrieved: { key: 'N', hint: 'N' },
  previous: { key: 'ArrowLeft', hint: '←' },
  next: { key: 'ArrowRight', hint: '→' },
  undo: { key: 'Z', hint: 'Z' },
};

/**
 * Decision buttons with single-key shortcuts (PRD Modul 4): I/E/M in stage 1,
 * I/E/N in stage 2, ←/→ to navigate, Z to undo. Every shortcut is also a
 * visible button; the full-text exclusion reason is picked from a radio group
 * (digits 1–9, Enter, Escape).
 */
export function DecisionPanel({
  stage,
  reasons,
  disabled,
  shortcuts,
  onDecide,
  onPrevious,
  onNext,
  onUndo,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('idle');
  const [optionalReason, setOptionalReason] = useState('');
  const ordered = sortedReasons(reasons);
  const fullText = stage === 'full_text';

  const include = () => onDecide({ stage, value: 'include' });
  const exclude = () => {
    if (fullText) setMode('reason');
    else
      onDecide({
        stage,
        value: 'exclude',
        ...(optionalReason && { reasonId: optionalReason }),
      });
  };
  const maybe = () => onDecide({ stage, value: 'maybe' });

  useShortcuts(
    disabled || mode !== 'idle'
      ? {
          ArrowLeft: () => onPrevious?.(),
          ArrowRight: () => onNext?.(),
          z: () => onUndo?.(),
        }
      : {
          i: include,
          e: exclude,
          ...(fullText ? { n: () => setMode('notRetrieved') } : { m: maybe }),
          ArrowLeft: () => onPrevious?.(),
          ArrowRight: () => onNext?.(),
          z: () => onUndo?.(),
        },
    shortcuts,
  );

  const action = (
    label: string,
    { key, hint }: { key: string; hint: string },
    onClick: () => void,
    primary = false,
  ) => (
    <button
      type="button"
      className={`${button.button} ${primary ? button.primary : ''}`}
      aria-keyshortcuts={shortcuts ? key : undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      {label}
      {shortcuts && <kbd className={styles.kbd}>{hint}</kbd>}
    </button>
  );

  const includeButton = action(t('screening.decision.include'), KEYS.include, include, true);
  const excludeButton = action(t('screening.decision.exclude'), KEYS.exclude, exclude);
  const thirdButton = fullText
    ? action(t('screening.decision.notRetrieved'), KEYS.notRetrieved, () => setMode('notRetrieved'))
    : action(t('screening.decision.maybe'), KEYS.maybe, maybe);
  const navigation = [
    navButton(t('screening.decision.previous'), KEYS.previous, onPrevious, shortcuts),
    navButton(t('screening.decision.next'), KEYS.next, onNext, shortcuts),
    navButton(t('screening.decision.undo'), KEYS.undo, onUndo, shortcuts),
  ];

  return (
    <section aria-labelledby="decision-heading" className={styles.panel}>
      <h2 id="decision-heading" className={styles.panelHeading}>
        {t('screening.decision.heading')}
      </h2>
      <div className={styles.decisionButtons}>
        {includeButton}
        {excludeButton}
        {thirdButton}
      </div>
      {!fullText && ordered.length > 0 && (
        <div className={forms.field}>
          <label htmlFor="optional-reason" className={forms.label}>
            {t('screening.decision.optionalReason')}
          </label>
          <select
            id="optional-reason"
            className={forms.input}
            value={optionalReason}
            onChange={(event) => setOptionalReason(event.target.value)}
          >
            <option value="">{t('screening.decision.noReason')}</option>
            {ordered.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === 'reason' && (
        <ReasonPicker
          reasons={ordered}
          onPick={(reasonId) => {
            setMode('idle');
            onDecide({ stage, value: 'exclude', reasonId });
          }}
          onCancel={() => setMode('idle')}
        />
      )}
      {mode === 'notRetrieved' && (
        <NotRetrievedForm
          onSubmit={(note) => {
            setMode('idle');
            onDecide({ stage, value: 'not_retrieved', ...(note && { note }) });
          }}
          onCancel={() => setMode('idle')}
        />
      )}
      <div className={styles.navButtons}>{navigation}</div>
    </section>
  );
}

function navButton(
  label: string,
  { key, hint }: { key: string; hint: string },
  onClick: (() => void) | undefined,
  shortcuts: boolean,
) {
  return (
    <button
      key={key}
      type="button"
      className={`${button.button} ${button.small}`}
      aria-keyshortcuts={shortcuts ? key : undefined}
      aria-disabled={!onClick || undefined}
      onClick={onClick}
    >
      {label}
      {shortcuts && <kbd className={styles.kbd}>{hint}</kbd>}
    </button>
  );
}

function ReasonPicker({
  reasons,
  onPick,
  onCancel,
}: {
  reasons: readonly ExclusionReason[];
  onPick: (reasonId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const [missing, setMissing] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const name = useId();
  useEffect(() => first.current?.focus(), []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (/^[1-9]$/.test(event.key)) {
      const reason = reasons[Number(event.key) - 1];
      if (reason) {
        event.preventDefault();
        onPick(reason.id);
      }
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected) onPick(selected);
    else setMissing(true);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- key handling for the radios inside
    <form className={styles.inlineForm} onSubmit={submit} onKeyDown={onKeyDown}>
      <fieldset className={forms.fieldset} aria-describedby={`${name}-hint`}>
        <legend className={forms.legend}>{t('screening.decision.reasonLegend')}</legend>
        <p id={`${name}-hint`} className={forms.hint}>
          {t('screening.decision.reasonHint')}
        </p>
        {reasons.map((reason, index) => (
          <label key={reason.id} className={forms.radioOption}>
            <input
              ref={index === 0 ? first : undefined}
              type="radio"
              name={name}
              value={reason.id}
              checked={selected === reason.id}
              onChange={() => {
                setSelected(reason.id);
                setMissing(false);
              }}
            />
            {index < 9 && <kbd className={styles.kbd}>{index + 1}</kbd>} {reason.label}
          </label>
        ))}
        {missing && <p className={forms.error}>{t('screening.decision.reasonRequired')}</p>}
      </fieldset>
      <div className={styles.decisionButtons}>
        <button type="submit" className={`${button.button} ${button.primary}`}>
          {t('screening.decision.confirmExclude')}
        </button>
        <button type="button" className={button.button} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function NotRetrievedForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <form
      className={styles.inlineForm}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(note.trim());
      }}
    >
      <div className={forms.field}>
        <label htmlFor="not-retrieved-note" className={forms.label}>
          {t('screening.decision.notRetrievedNote')}
        </label>
        <input
          id="not-retrieved-note"
          ref={input}
          className={forms.input}
          value={note}
          autoComplete="off"
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      <div className={styles.decisionButtons}>
        <button type="submit" className={`${button.button} ${button.primary}`}>
          {t('screening.decision.confirmNotRetrieved')}
        </button>
        <button type="button" className={button.button} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
