import { cacheByteSizeForEvent } from '../../cache/cache-byte-size';
import { eventLedgerRecord } from '../../cache/event-ledger';
import { feedCursorLedgerRecord } from '../../events/feed-cache-ledger';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursor,
  StoredEvent,
} from '../../events/types';
import type { NostrEvent } from '../../protocol';
import {
  sqlitePutFeedCursorWithLedger,
  sqlitePutStoredEventWithLedger,
  sqliteReadStoredEvent,
  sqliteReadStoredEvents,
} from '../sqlite-opfs/events-sqlite';

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
  return (await sqliteReadStoredEvent(id).catch(() => undefined)) ?? fallback;
}

export async function readStoredEventRows(
  ids: readonly string[],
  fallback: readonly StoredEvent[],
): Promise<(StoredEvent | undefined)[]> {
  const rows = await sqliteReadStoredEvents(ids).catch(() => undefined);
  return rows ?? [...fallback];
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
  await sqlitePutStoredEventWithLedger(
    input,
    eventLedgerRecord(
      input.event,
      input.tags,
      false,
      cacheBytes,
      input.receivedAt,
    ),
  ).catch(() => false);
}

export async function putFeedCursorWithLedger(
  cursor: FeedCursor,
): Promise<void> {
  await sqlitePutFeedCursorWithLedger(
    cursor,
    feedCursorLedgerRecord(cursor),
  ).catch(() => false);
}
