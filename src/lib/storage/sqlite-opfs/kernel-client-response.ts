import type { StorageDiagnostics, StorageResponse } from './types';

export function sqliteStorageUnavailable(): StorageResponse {
  return localResponse('sqlite-storage-unavailable', 'unavailable', {
    storageOwner: 'unavailable',
    ownerReason: 'worker-open-failed',
    message: 'Worker support unavailable',
  });
}

export function localResponse(
  requestId: string,
  outcome: StorageResponse['outcome'],
  diagnostics: StorageDiagnostics,
): StorageResponse {
  return { requestId, outcome, rows: [], rowsAffected: 0, diagnostics };
}
