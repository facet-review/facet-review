import { useEffect, useRef } from 'react';
import notice from './notice.module.css';

export interface SummaryItem {
  /** id of the field to jump to */
  target: string;
  message: string;
}

/**
 * Error summary shown above a form after a failed submit (GOV.UK pattern):
 * receives focus, lists every problem and links to the field.
 */
export function ErrorSummary({ title, items }: { title: string; items: readonly SummaryItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className={`${notice.notice} ${notice.error}`}
    >
      <h2 id="error-summary-title">{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.target + item.message}>
            <a
              href={`#${item.target}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(item.target)?.focus();
              }}
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
