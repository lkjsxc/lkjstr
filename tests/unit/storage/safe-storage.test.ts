import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  indexedDbAvailable,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from '../../../src/lib/storage/safe-storage';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
const indexedDbDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'indexedDB',
);

describe('safe storage helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restoreGlobal('localStorage', localStorageDescriptor);
    restoreGlobal('indexedDB', indexedDbDescriptor);
  });

  it('catches localStorage property and operation errors', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied');
      },
    });
    expect(safeGetItem('x')).toBeNull();
    expect(safeSetItem('x', 'y')).toBe(false);
    expect(safeRemoveItem('x')).toBe(false);
  });

  it('detects blocked IndexedDB without throwing', () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(indexedDbAvailable()).toBe(false);
  });

  it('bounds unavailable and slow storage operations', async () => {
    expect(await boundedStorageRead(async () => 'stored', 'fallback')).toBe(
      'fallback',
    );
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    vi.useFakeTimers();
    const read = boundedStorageRead<string>(
      () => new Promise(() => undefined),
      'fallback',
      10,
    );
    await vi.advanceTimersByTimeAsync(11);
    expect(await read).toBe('fallback');
    const write = bestEffortStorageWrite(
      () => new Promise(() => undefined),
      10,
    );
    await vi.advanceTimersByTimeAsync(11);
    await write;
  });
});

function restoreGlobal(
  name: 'localStorage' | 'indexedDB',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
