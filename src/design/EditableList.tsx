import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import button from './button.module.css';
import forms from './forms.module.css';
import styles from './EditableList.module.css';

export interface EditableItem {
  key: string;
  value: string;
}

interface EditableListProps {
  label: string;
  /** Hide the visible label when a surrounding heading already says the same. */
  hideLabel?: boolean;
  hint?: string;
  items: readonly EditableItem[];
  /** Accessible name of the n-th item (1-based), e.g. "Inclusion criterion 3". */
  itemLabel: (n: number) => string;
  addLabel: string;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  /** Explanation why an item cannot be removed (e.g. still referenced), if so. */
  removeBlocked?: (index: number) => string | undefined;
}

type PendingFocus =
  | { kind: 'input'; index: number }
  | { kind: 'move'; index: number; direction: -1 | 1 }
  | { kind: 'add' };

/**
 * Ordered list of editable text entries, fully operable by keyboard:
 * reordering uses buttons (no drag and drop), and focus follows the item
 * after moving, adding or removing.
 */
export function EditableList({
  label,
  hideLabel = false,
  hint,
  items,
  itemLabel,
  addLabel,
  onChange,
  onAdd,
  onRemove,
  onMove,
  removeBlocked,
}: EditableListProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const moveButtons = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const addButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<PendingFocus | null>(null);

  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    if (target.kind === 'input') inputs.current[target.index]?.focus();
    if (target.kind === 'add') addButton.current?.focus();
    if (target.kind === 'move')
      moveButtons.current.get(`${target.index}:${target.direction}`)?.focus();
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    pending.current = { kind: 'move', index: target, direction };
    onMove(index, direction);
  };

  const remove = (index: number) => {
    const remaining = items.length - 1;
    pending.current =
      remaining === 0 ? { kind: 'add' } : { kind: 'input', index: Math.min(index, remaining - 1) };
    onRemove(index);
  };

  const add = () => {
    pending.current = { kind: 'input', index: items.length };
    onAdd();
  };

  return (
    <div className={forms.field} role="group" aria-labelledby={headingId}>
      <span id={headingId} className={hideLabel ? 'visually-hidden' : forms.label}>
        {label}
      </span>
      {hint && <p className={forms.hint}>{hint}</p>}
      {items.length === 0 ? (
        <p className={forms.hint}>{t('common.emptyList')}</p>
      ) : (
        <ol className={styles.list}>
          {items.map((item, index) => {
            const name = itemLabel(index + 1);
            const inputId = `${headingId}-${index}`;
            const blocked = removeBlocked?.(index);
            return (
              <li key={item.key} className={styles.item}>
                <label htmlFor={inputId} className="visually-hidden">
                  {name}
                </label>
                <input
                  id={inputId}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  className={forms.input}
                  value={item.value}
                  autoComplete="off"
                  onChange={(e) => onChange(index, e.target.value)}
                />
                <div className={styles.controls}>
                  {([-1, 1] as const).map((direction) => {
                    const disabled = index + direction < 0 || index + direction >= items.length;
                    return (
                      <button
                        key={direction}
                        ref={(el) => {
                          moveButtons.current.set(`${index}:${direction}`, el);
                        }}
                        type="button"
                        className={`${button.button} ${button.small}`}
                        aria-disabled={disabled || undefined}
                        onClick={() => move(index, direction)}
                      >
                        {t(direction === -1 ? 'common.moveUp' : 'common.moveDown')}
                        <span className="visually-hidden">{` – ${name}`}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`${button.button} ${button.small} ${button.danger}`}
                    aria-disabled={blocked ? true : undefined}
                    aria-describedby={blocked ? `${inputId}-blocked` : undefined}
                    onClick={blocked ? undefined : () => remove(index)}
                  >
                    {t('common.remove')}
                    <span className="visually-hidden">{` – ${name}`}</span>
                  </button>
                </div>
                {blocked && (
                  <p id={`${inputId}-blocked`} className={styles.blocked}>
                    {blocked}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <button ref={addButton} type="button" className={button.button} onClick={add}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}
