import type {
  StorageFailureReason,
  StorageOperationKind,
} from './storage-result';

export type TrackedStorageOperationStatus =
  | 'active'
  | 'returned-timeout'
  | 'settled-ok'
  | 'settled-error';

export type TrackedStorageOperation = {
  readonly operationId: string;
  readonly kind: StorageOperationKind;
  readonly tables: readonly string[];
  readonly startedAt: number;
  readonly deadlineAt?: number;
  readonly returnedAt?: number;
  readonly settledAt?: number;
  readonly status: TrackedStorageOperationStatus;
  readonly lateSettlementMs?: number;
  readonly errorKind?: StorageFailureReason;
};

export type ActiveStorageOperationGroup = {
  readonly key: string;
  readonly status: 'active' | 'returned-timeout';
  readonly kind: StorageOperationKind;
  readonly tables: readonly string[];
  readonly count: number;
  readonly oldestMs: number;
};

let nextId = 0;
const operations = new Map<string, TrackedStorageOperation>();

export function startStorageOperation(input: {
  readonly kind: StorageOperationKind;
  readonly tables?: readonly string[];
  readonly timeoutMs?: number;
}): TrackedStorageOperation {
  const startedAt = Date.now();
  const operation = {
    operationId: `storage:${++nextId}`,
    kind: input.kind,
    tables: input.tables ?? [],
    startedAt,
    deadlineAt:
      input.timeoutMs === undefined ? undefined : startedAt + input.timeoutMs,
    status: 'active',
  } satisfies TrackedStorageOperation;
  operations.set(operation.operationId, operation);
  return operation;
}

export function markStorageOperationTimeout(operationId: string): void {
  const existing = operations.get(operationId);
  if (!existing || existing.status !== 'active') return;
  operations.set(operationId, {
    ...existing,
    returnedAt: Date.now(),
    status: 'returned-timeout',
  });
}

export function settleStorageOperation(
  operationId: string,
  status: 'settled-ok' | 'settled-error',
  errorKind?: StorageFailureReason,
): void {
  const existing = operations.get(operationId);
  if (!existing) return;
  const settledAt = Date.now();
  operations.set(operationId, {
    ...existing,
    settledAt,
    status,
    errorKind,
    lateSettlementMs: lateSettlementMs(existing, settledAt),
  });
}

export function storageOperationSnapshots(): readonly TrackedStorageOperation[] {
  return [...operations.values()].sort((a, b) =>
    a.operationId.localeCompare(b.operationId),
  );
}

export function activeStorageOperationCount(): number {
  return [...operations.values()].filter(
    (operation) =>
      operation.status === 'active' ||
      operation.status === 'returned-timeout',
  ).length;
}

export function activeStorageOperationGroups(): readonly ActiveStorageOperationGroup[] {
  const now = Date.now();
  const groups = new Map<string, ActiveStorageOperationGroup>();
  for (const operation of operations.values()) {
    if (
      operation.status !== 'active' &&
      operation.status !== 'returned-timeout'
    )
      continue;
    const tables = [...operation.tables].sort();
    const key = `${operation.status}:${operation.kind}:${tables.join('+')}`;
    const current = groups.get(key);
    const oldestMs = now - operation.startedAt;
    groups.set(key, {
      key,
      status: operation.status,
      kind: operation.kind,
      tables,
      count: (current?.count ?? 0) + 1,
      oldestMs: Math.max(current?.oldestMs ?? 0, oldestMs),
    });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function resetStorageOperationTracking(): void {
  nextId = 0;
  operations.clear();
}

function lateSettlementMs(
  operation: TrackedStorageOperation,
  settledAt: number,
): number | undefined {
  if (operation.status !== 'returned-timeout' || !operation.returnedAt)
    return undefined;
  return Math.max(0, settledAt - operation.returnedAt);
}
