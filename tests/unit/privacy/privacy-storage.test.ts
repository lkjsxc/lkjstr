import { afterEach, describe, expect, test, vi } from 'vitest';
import { acceptAllPrivacy } from '../../../src/lib/privacy/consent';
import {
  clearOptionalPrivacyData,
  loadPrivacyConsent,
  optionalStoragePrefix,
  privacyConsentKey,
  savePrivacyConsent,
} from '../../../src/lib/privacy/storage';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);

describe('privacy storage adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (localStorageDescriptor)
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  test('saves and loads the essential consent record', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const record = acceptAllPrivacy(10);

    expect(savePrivacyConsent(record)).toBe(true);
    expect(storage.getItem(privacyConsentKey)).toContain('"cookies":true');
    expect(loadPrivacyConsent()).toEqual(record);
  });

  test('blocked consent storage keeps optional processing disabled', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    expect(savePrivacyConsent(acceptAllPrivacy(11))).toBe(false);
    expect(loadPrivacyConsent()).toBeUndefined();
  });

  test('withdrawal cleanup removes optional local records only', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem(`${optionalStoragePrefix}telemetry`, 'queued');
    storage.setItem('lkjstr.workspace', 'essential');

    clearOptionalPrivacyData();

    expect(storage.getItem(`${optionalStoragePrefix}telemetry`)).toBeNull();
    expect(storage.getItem('lkjstr.workspace')).toBe('essential');
  });
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  } as Storage;
}
