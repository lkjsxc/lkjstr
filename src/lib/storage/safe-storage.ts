import { incMemoryCounter, decMemoryCounter } from '../app/memory-counters';
import { setRuntimeCounterActive } from '../app/runtime-counters';

export const defaultStorageTimeoutMs = 150;

export function safeLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return safeLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    const storage = safeLocalStorage();
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    const storage = safeLocalStorage();
    storage?.removeItem(key);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function indexedDbAvailable(): boolean {
  try {
    return Boolean(globalThis.indexedDB?.open);
  } catch {
    return false;
  }
}

export async function boundedStorageRead<T>(
  read: () => Promise<T>,
  fallback: T,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<T> {
  if (!indexedDbAvailable()) return fallback;
  setRuntimeCounterActive('active-indexeddb-ops', 1);
  incMemoryCounter('active-indexeddb-ops');
  try {
    return await withTimeout(read(), fallback, timeoutMs);
  } catch {
    return fallback;
  } finally {
    setRuntimeCounterActive('active-indexeddb-ops', -1);
    decMemoryCounter('active-indexeddb-ops');
  }
}

export async function bestEffortStorageWrite(
  write: () => Promise<unknown>,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  setRuntimeCounterActive('active-indexeddb-ops', 1);
  incMemoryCounter('active-indexeddb-ops');
  try {
    await withTimeout(write(), undefined, timeoutMs);
  } catch {
    return;
  } finally {
    setRuntimeCounterActive('active-indexeddb-ops', -1);
    decMemoryCounter('active-indexeddb-ops');
  }
}

export async function bestEffortDiagnosticStorageWrite(
  write: () => Promise<unknown>,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  try {
    await withTimeout(write(), undefined, timeoutMs);
  } catch {
    return;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
