export function indexedDbAvailable(): boolean {
  try {
    return Boolean(globalThis.indexedDB?.open);
  } catch {
    return false;
  }
}
