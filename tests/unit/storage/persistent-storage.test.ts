import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStoragePersistenceState,
  requestStoragePersistence,
} from '../../../src/lib/storage/persistent-storage';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

describe('persistent storage helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (navigatorDescriptor)
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('reports unsupported storage persistence', async () => {
    vi.stubGlobal('navigator', {});
    await expect(readStoragePersistenceState()).resolves.toEqual({
      supported: false,
      persisted: null,
    });
    await expect(requestStoragePersistence()).resolves.toMatchObject({
      supported: false,
      granted: null,
      reason: 'unsupported',
    });
  });

  it('reports already persisted storage without requesting again', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', {
      storage: { persisted: async () => true, persist },
    });
    await expect(requestStoragePersistence()).resolves.toEqual({
      supported: true,
      persisted: true,
      granted: true,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports granted, denied, and failed request results', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: async () => false, persist: async () => true },
    });
    await expect(requestStoragePersistence()).resolves.toMatchObject({
      supported: true,
      persisted: true,
      granted: true,
    });

    vi.stubGlobal('navigator', {
      storage: { persisted: async () => false, persist: async () => false },
    });
    await expect(requestStoragePersistence()).resolves.toMatchObject({
      persisted: false,
      granted: false,
    });

    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => {
          throw new Error('blocked');
        },
        persist: async () => true,
      },
    });
    await expect(requestStoragePersistence()).resolves.toMatchObject({
      persisted: null,
      granted: null,
      reason: 'failed',
    });
  });
});
