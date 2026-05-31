import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMemoryCounter,
  resetMemoryCounters,
} from '../../../src/lib/app/memory-counters';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  indexedDbAvailable,
  readWithStorageResult,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
  writeWithStorageResult,
} from '../../../src/lib/storage/safe-storage';
import {
  resetStorageOperationTracking,
  storageOperationSnapshots,
} from '../../../src/lib/storage/operation/tracked-operation';

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
    resetMemoryCounters();
    resetStorageOperationTracking();
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
    const slowRead = deferred<string>();
    const read = boundedStorageRead(() => slowRead.promise, 'fallback', 10);
    await vi.advanceTimersByTimeAsync(11);
    expect(await read).toBe('fallback');
    slowRead.resolve('late');
    await vi.advanceTimersByTimeAsync(0);
    const slowWrite = deferred<void>();
    const write = bestEffortStorageWrite(() => slowWrite.promise, 10);
    await vi.advanceTimersByTimeAsync(11);
    await write;
    slowWrite.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it('tracks late storage success until the underlying operation settles', async () => {
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    vi.useFakeTimers();
    const slowRead = deferred<string>();
    const read = readWithStorageResult(() => slowRead.promise, 'fallback', 10);
    await vi.advanceTimersByTimeAsync(11);
    await expect(read).resolves.toMatchObject({
      ok: false,
      reason: 'timeout',
      fallback: 'fallback',
    });
    expect(getMemoryCounter('active-indexeddb-ops')).toBe(1);
    expect(storageOperationSnapshots()[0]).toMatchObject({
      status: 'returned-timeout',
    });
    slowRead.resolve('stored');
    await vi.advanceTimersByTimeAsync(0);
    expect(getMemoryCounter('active-indexeddb-ops')).toBe(0);
    expect(storageOperationSnapshots()[0]).toMatchObject({
      status: 'settled-ok',
    });
  });

  it('tracks late storage rejection after timeout', async () => {
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    vi.useFakeTimers();
    const slowRead = deferred<string>();
    const read = readWithStorageResult(() => slowRead.promise, 'fallback', 10);
    await vi.advanceTimersByTimeAsync(11);
    await read;
    slowRead.reject(new Error('late'));
    await vi.advanceTimersByTimeAsync(0);
    expect(storageOperationSnapshots()[0]).toMatchObject({
      status: 'settled-error',
      errorKind: 'unknown',
    });
  });

  it('reports quota write failures', async () => {
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    const error = new Error('quota');
    error.name = 'QuotaExceededError';
    await expect(
      writeWithStorageResult(async () => {
        throw error;
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'quota-exceeded' });
  });
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function restoreGlobal(
  name: 'localStorage' | 'indexedDB',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
