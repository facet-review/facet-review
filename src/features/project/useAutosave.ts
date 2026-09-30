import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saved';

/**
 * Saves `value` after `delay` ms without further changes. The initial value is
 * not saved; a pending save is flushed when the component unmounts.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delay = 500) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const initial = useRef(value);
  const pending = useRef<{ value: T; timer: ReturnType<typeof setTimeout> } | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (value === initial.current) return;
    if (pending.current) clearTimeout(pending.current.timer);
    setStatus('pending');
    const timer = setTimeout(() => {
      pending.current = null;
      void saveRef.current(value).then(() => setStatus('saved'));
    }, delay);
    pending.current = { value, timer };
  }, [value, delay]);

  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        void saveRef.current(pending.current.value);
      }
    },
    [],
  );

  return status;
}
