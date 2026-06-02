import type { StoredEvent } from '../../../src/lib/events/types';
import type { StorageResponse } from '../../../src/lib/storage/sqlite-opfs/types';

export function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
): StorageResponse {
  return { requestId: 'test', outcome, rows, rowsAffected: 0, diagnostics: {} };
}

export function eventRow(event: StoredEvent): StorageResponse['rows'][number] {
  return {
    event_json: JSON.stringify(event),
    relay_urls_json: JSON.stringify(event.relayUrls),
  };
}

export function ledger(id: string) {
  return {
    id,
    ownerKind: 'notification' as const,
    resourceKind: 'notification-record' as const,
    resourceId: id,
    score: 1,
    createdAt: 1,
    updatedAt: 1,
    cacheBytes: 1,
    protected: false,
  };
}

export function storedEvent(
  id: string,
  createdAt: number,
  relayUrls: readonly string[],
): StoredEvent {
  return {
    id,
    pubkey: 'p'.repeat(64),
    created_at: createdAt,
    kind: 1,
    tags: [],
    content: 'hello',
    sig: 's'.repeat(128),
    receivedAt: createdAt * 1000,
    relayUrls,
  };
}
