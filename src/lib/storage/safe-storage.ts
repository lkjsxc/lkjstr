import { incMemoryCounter, decMemoryCounter } from '../app/memory-counters';
import { setRuntimeCounterActive } from '../app/runtime-counters';
import { indexedDbAvailable } from './operation/availability';
import { withDeadline } from './operation/deadlines';
import {
  markStorageOperationTimeout,
  settleStorageOperation,
  startStorageOperation,
} from './operation/tracked-operation';
import {
  storageFailureReason,
  type StorageFailureReason,
  type StorageOperationKind,
  type StorageReadResult,
  type StorageWriteResult,
} from './operation/storage-result';
export {
  safeGetItem,
  safeLocalStorage,
  safeRemoveItem,
  safeSetItem,
} from './local-storage';

export const defaultStorageTimeoutMs = 150;

export { indexedDbAvailable } from './operation/availability';

export async function boundedStorageRead<T>(
  read: () => Promise<T>,
  fallback: T,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<T> {
  const result = await readWithStorageResult(read, fallback, timeoutMs);
  return result.ok ? result.value : result.fallback;
}

export async function bestEffortStorageWrite(
  write: () => Promise<unknown>,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<void> {
  await writeWithStorageResult(write, timeoutMs);
}

export async function bestEffortDiagnosticStorageWrite(
  write: () => Promise<unknown>,
  timeoutMs = defaultStorageTimeoutMs,
): Promise<void> {
  await writeWithStorageResult(write, timeoutMs, { kind: 'write' });
}

export async function readWithStorageResult<T>(
  read: () => Promise<T>,
  fallback: T,
  timeoutMs = defaultStorageTimeoutMs,
  options: OperationOptions = {},
): Promise<StorageReadResult<T>> {
  const operation = startStorageOperation({
    kind: options.kind ?? 'read',
    tables: options.tables,
    timeoutMs,
  });
  const startedAt = Date.now();
  if (!indexedDbAvailable())
    return readFailure(
      operation.operationId,
      'unavailable',
      fallback,
      startedAt,
    );
  const promise = Promise.resolve().then(read);
  trackSettlement(operation.operationId, promise);
  try {
    const result = await withDeadline(promise, timeoutMs);
    if (result.timedOut) {
      markStorageOperationTimeout(operation.operationId);
      return {
        ok: false,
        reason: 'timeout',
        fallback,
        durationMs: Date.now() - startedAt,
        operationId: operation.operationId,
      };
    }
    return {
      ok: true,
      value: result.value,
      durationMs: Date.now() - startedAt,
      operationId: operation.operationId,
    };
  } catch (error) {
    return readFailure(
      operation.operationId,
      storageFailureReason(error),
      fallback,
      startedAt,
    );
  }
}

export async function writeWithStorageResult(
  write: () => Promise<unknown>,
  timeoutMs = defaultStorageTimeoutMs,
  options: OperationOptions = {},
): Promise<StorageWriteResult> {
  const operation = startStorageOperation({
    kind: options.kind ?? 'write',
    tables: options.tables,
    timeoutMs,
  });
  const startedAt = Date.now();
  if (!indexedDbAvailable())
    return writeFailure(operation.operationId, 'unavailable', startedAt);
  const promise = Promise.resolve().then(write);
  trackSettlement(operation.operationId, promise);
  try {
    const result = await withDeadline(promise, timeoutMs);
    if (result.timedOut) {
      markStorageOperationTimeout(operation.operationId);
      return {
        ok: false,
        reason: 'timeout',
        durationMs: Date.now() - startedAt,
        operationId: operation.operationId,
      };
    }
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      operationId: operation.operationId,
    };
  } catch (error) {
    return writeFailure(
      operation.operationId,
      storageFailureReason(error),
      startedAt,
    );
  }
}

type OperationOptions = {
  readonly kind?: StorageOperationKind;
  readonly tables?: readonly string[];
};

function trackSettlement<T>(operationId: string, promise: Promise<T>): void {
  setRuntimeCounterActive('active-indexeddb-ops', 1);
  incMemoryCounter('active-indexeddb-ops');
  promise
    .then(
      () => settleStorageOperation(operationId, 'settled-ok'),
      (error: unknown) =>
        settleStorageOperation(
          operationId,
          'settled-error',
          storageFailureReason(error),
        ),
    )
    .finally(() => {
      setRuntimeCounterActive('active-indexeddb-ops', -1);
      decMemoryCounter('active-indexeddb-ops');
    });
}

function readFailure<T>(
  operationId: string,
  reason: StorageFailureReason,
  fallback: T,
  startedAt: number,
): StorageReadResult<T> {
  settleStorageOperation(operationId, 'settled-error', reason);
  return {
    ok: false,
    reason,
    fallback,
    durationMs: Date.now() - startedAt,
    operationId,
  };
}

function writeFailure(
  operationId: string,
  reason: StorageFailureReason,
  startedAt: number,
): StorageWriteResult {
  settleStorageOperation(operationId, 'settled-error', reason);
  return {
    ok: false,
    reason,
    durationMs: Date.now() - startedAt,
    operationId,
  };
}
