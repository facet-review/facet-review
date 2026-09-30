import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import button from './button.module.css';
import styles from './ConfirmDialog.module.css';

export interface DialogAction {
  label: string;
  onSelect: () => void;
  variant?: 'primary' | 'danger';
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: readonly DialogAction[];
  onCancel: () => void;
}

/**
 * Modal confirmation based on the native <dialog> element (focus trapping,
 * Escape to cancel, inert background). Cancel comes first, so it receives
 * the initial focus – destructive actions are never the default.
 */
export function ConfirmDialog({ open, title, children, actions, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div id={bodyId} className={styles.body}>
        {children}
      </div>
      <div className={styles.actions}>
        <button type="button" className={button.button} onClick={onCancel}>
          {t('common.cancel')}
        </button>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={`${button.button} ${action.variant ? button[action.variant] : ''}`}
            onClick={action.onSelect}
          >
            {action.label}
          </button>
        ))}
      </div>
    </dialog>
  );
}
