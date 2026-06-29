import type {
  StorageDiagnostics,
  StorageRequest,
  StorageResponse,
} from './types';

export function response(
  request: StorageRequest,
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
  rowsAffected = 0,
  diagnostics: StorageDiagnostics = {},
): StorageResponse {
  return {
    requestId: request.requestId,
    outcome,
    rows,
    rowsAffected,
    diagnostics,
  };
}

export function parseRequest(value: unknown): StorageRequest | undefined {
  if (!record(value)) return undefined;
  if (typeof value.requestId !== 'string') return undefined;
  if (typeof value.deadlineMs !== 'number') return undefined;
  if (!record(value.op) || typeof value.op.kind !== 'string') return undefined;
  return value as StorageRequest;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
