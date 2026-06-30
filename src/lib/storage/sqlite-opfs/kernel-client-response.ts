import type { StorageDiagnostics, StorageResponse } from './types';

type UnavailableReason = NonNullable<StorageDiagnostics['ownerReason']>;

export function sqliteStorageUnavailable(
  ownerReason: UnavailableReason = 'worker-open-failed',
  message = 'Worker support unavailable',
): StorageResponse {
  return localResponse('sqlite-storage-unavailable', 'unavailable', {
    storageOwner: 'unavailable',
    ownerReason,
    message,
  });
}

export function sqliteOpenUnavailable(
  response: StorageResponse,
): StorageResponse {
  if (response.diagnostics.ownerReason || response.outcome !== 'unavailable')
    return response;
  return {
    ...response,
    diagnostics: { ...response.diagnostics, ownerReason: 'sqlite-open-failed' },
  };
}

export function localResponse(
  requestId: string,
  outcome: StorageResponse['outcome'],
  diagnostics: StorageDiagnostics,
): StorageResponse {
  return { requestId, outcome, rows: [], rowsAffected: 0, diagnostics };
}
