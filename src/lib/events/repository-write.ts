import { cacheByteSizeForEvent } from '../cache/cache-byte-size';
import {
  eventPriorityRecord,
  upsertEventPriority,
} from '../cache/event-priority';
import { browserDb } from '../storage/browser-db';
import { bestEffortStorageWrite } from '../storage/safe-storage';
import type { NostrEvent } from '../protocol';
import type { EventRelayReceipt, EventTagRow, StoredEvent } from './types';

export type StoredEventWrite = {
  readonly event: NostrEvent;
  readonly stored: StoredEvent;
  readonly receipts: readonly EventRelayReceipt[];
  readonly tags: readonly EventTagRow[];
  readonly receivedAt: number;
};

export async function writeStoredEvent(input: StoredEventWrite): Promise<void> {
  const priority = eventPriorityRecord(
    input.event,
    input.tags,
    false,
    0,
    input.receivedAt,
  );
  const cacheBytes = cacheByteSizeForEvent(
    input.stored,
    input.receipts,
    input.tags,
    priority,
  );
  await bestEffortStorageWrite(async () => {
    await browserDb().transaction(
      'rw',
      browserDb().events,
      browserDb().eventRelays,
      browserDb().eventTags,
      browserDb().cacheLedger,
      async () => {
        await browserDb().events.put(input.stored);
        await browserDb().eventRelays.bulkPut([...input.receipts]);
        await browserDb()
          .eventTags.where('eventId')
          .equals(input.event.id)
          .delete();
        if (input.tags.length > 0)
          await browserDb().eventTags.bulkPut([...input.tags]);
        await upsertEventPriority(
          input.event,
          input.tags,
          false,
          cacheBytes,
          input.receivedAt,
        );
      },
    );
  });
}
