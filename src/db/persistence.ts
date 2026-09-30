/**
 * Asks the browser to keep IndexedDB data under storage pressure
 * (navigator.storage.persist). Browsers may decline; the JSON backup
 * reminder covers that case.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
