import { cacheByteSizeForEvent } from '../../cache/cache-byte-size';
import { cacheLedgerId } from '../../cache/cache-ledger-id';
import {
  eventLedgerRecord,
  eventTargetBumps,
} from '../../cache/event-ledger';
import { feedCursorLedgerRecord } from '../../events/feed-cache-ledger';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursor,
  StoredEvent,
} from '../../events/types';
import type { NostrEvent } from '../../protocol';
import { boundedStorageRead } from '../safe-storage';
import { browserDb, type LkjstrDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';

export type StoredEventWrite = {
  readonly event: NostrEvent;
  readonly stored: StoredEvent;
  readonly receipts: readonly EventRelayReceipt[];
  readonly tags: readonly EventTagRow[];
  readonly receivedAt: number;
};

export async function readStoredEventRow(
  id: string,
  fallback: StoredEvent | undefined,
): Promise<StoredEvent | undefined> {
  return boundedStorageRead(() => browserDb().events.get(id), fallback);
}

export async function readStoredEventRows(
  ids: readonly string[],
  fallback: readonly StoredEvent[],
): Promise<(StoredEvent | undefined)[]> {
  return boundedStorageRead(() => browserDb().events.bulkGet([...ids]), [
    ...fallback,
  ]);
}

export async function putStoredEventWithLedger(
  input: StoredEventWrite,
): Promise<void> {
  const draft = eventLedgerRecord(
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
    draft,
  );
  await withStorageTransaction({
    mode: 'rw',
    tables: ['events', 'eventRelays', 'eventTags', 'cacheLedger'],
    purpose: 'event-write',
    run: async (db) => {
      await db.events.put(input.stored);
      await db.eventRelays.bulkPut([...input.receipts]);
      await db.eventTags.where('eventId').equals(input.event.id).delete();
      if (input.tags.length > 0) await db.eventTags.bulkPut([...input.tags]);
      await putEventLedger(db, input, cacheBytes);
    },
  });
}

export async function putFeedCursorWithLedger(
  cursor: FeedCursor,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['feedCursors', 'cacheLedger'],
    purpose: 'feed-cursor-write',
    run: async (db) => {
      await db.feedCursors.put(cursor);
      await db.cacheLedger.put(feedCursorLedgerRecord(cursor));
    },
  });
}

async function putEventLedger(
  db: LkjstrDb,
  input: StoredEventWrite,
  cacheBytes: number,
): Promise<void> {
  await db.cacheLedger.put(
    eventLedgerRecord(
      input.event,
      input.tags,
      false,
      cacheBytes,
      input.receivedAt,
    ),
  );
  for (const [eventId, delta] of eventTargetBumps(input.event))
    await bumpEventLedger(db, eventId, delta);
}

async function bumpEventLedger(
  db: LkjstrDb,
  eventId: string,
  delta: number,
): Promise<void> {
  const existing = await db.cacheLedger.get(cacheLedgerId('event', eventId));
  if (!existing || existing.protected) return;
  await db.cacheLedger.put({
    ...existing,
    score: existing.score + delta,
    updatedAt: Date.now(),
  });
}
