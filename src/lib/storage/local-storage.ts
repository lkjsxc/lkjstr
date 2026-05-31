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
