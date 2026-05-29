import type { EventRelayReceipt, EventTagRow, StoredEvent } from '../events/types';
import type { EventPriorityRecord } from './event-priority';

const encoder = new TextEncoder();

export function encodedJsonBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function cacheByteSizeForEvent(
  stored: StoredEvent,
  receipts: readonly EventRelayReceipt[],
  tags: readonly EventTagRow[],
  priority: EventPriorityRecord,
): number {
  return (
    encodedJsonBytes(stored) +
    receipts.reduce((sum, row) => sum + encodedJsonBytes(row), 0) +
    tags.reduce((sum, row) => sum + encodedJsonBytes(row), 0) +
    encodedJsonBytes({ ...priority, cacheBytes: 0 })
  );
}
