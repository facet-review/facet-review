import type { ClientDeps } from '../../../domain/openalex/client';

/** The browser's fetch and timers for the OpenAlex client (connect-src allows only this host). */
export const browserDeps: ClientDeps = {
  fetch: (url, init) => fetch(url, { signal: init.signal, credentials: 'omit' }),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
