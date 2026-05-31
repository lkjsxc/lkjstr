export type StorageOperationKind =
  | 'read'
  | 'write'
  | 'transaction'
  | 'inventory'
  | 'repair'
  | 'compaction';

export type StorageFailureReason =
  | 'unavailable'
  | 'timeout'
  | 'quota-exceeded'
  | 'blocked'
  | 'corrupt'
  | 'aborted-by-owner'
  | 'unknown';

export type StorageReadResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly durationMs: number;
      readonly operationId: string;
    }
  | {
      readonly ok: false;
      readonly reason: StorageFailureReason;
      readonly fallback: T;
      readonly durationMs: number;
      readonly operationId: string;
    };

export type StorageWriteResult =
  | {
      readonly ok: true;
      readonly durationMs: number;
      readonly operationId: string;
    }
  | {
      readonly ok: false;
      readonly reason: StorageFailureReason;
      readonly durationMs: number;
      readonly operationId: string;
    };

export function storageFailureReason(error: unknown): StorageFailureReason {
  const name = errorName(error);
  if (name === 'QuotaExceededError') return 'quota-exceeded';
  if (name === 'AbortError') return 'aborted-by-owner';
  if (name === 'DataError' || name === 'SyntaxError') return 'corrupt';
  if (
    name === 'BlockedError' ||
    name === 'InvalidStateError' ||
    name === 'NotFoundError' ||
    name === 'VersionError'
  )
    return 'blocked';
  return 'unknown';
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === 'object' && error && 'name' in error) {
    const name = (error as { readonly name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
}
