import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser believes it is online (it can be wrong; errors are handled separately). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
