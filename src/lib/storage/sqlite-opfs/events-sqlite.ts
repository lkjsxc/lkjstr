import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCursor,
  StoredEvent,
} from '../../events/types';
import type { NostrEvent } from '../../protocol';
import { ensureEventGraphSchema } from './event-schema';
import { decodeStoredEventRow, storedEventColumns } from './event-row-codec';
import { sendSqliteStorage } from './kernel-client';
import type { SqlStep } from './types';

export type SqliteStoredEventWrite = {
  readonly event: NostrEvent;
  readonly stored: StoredEvent;
  readonly receipts: readonly EventRelayReceipt[];
  readonly tags: readonly EventTagRow[];
  readonly receivedAt: number;
};

export async function sqliteReadStoredEvent(
  id: string,
): Promise<StoredEvent | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT ${storedEventColumns} FROM events WHERE id = ?1;`,
      params: [id],
      rowLimit: 1,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows[0] ? decodeStoredEventRow(response.rows[0]) : undefined;
}

export async function sqliteReadStoredEvents(
  ids: readonly string[],
): Promise<(StoredEvent | undefined)[] | undefined> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  if (!(await ensureEventGraphSchema())) return undefined;
  const placeholders = unique.map((_, index) => `?${index + 1}`).join(', ');
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT ${storedEventColumns} FROM events WHERE id IN (${placeholders});`,
      params: unique,
      rowLimit: unique.length,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  const byId = new Map(
    response.rows.flatMap((row) => {
      const event = decodeStoredEventRow(row);
      return event ? [[event.id, event] as const] : [];
    }),
  );
  return ids.map((id) => byId.get(id));
}

export async function sqlitePutStoredEventWithLedger(
  input: SqliteStoredEventWrite,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  if (!(await ensureEventGraphSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: [
        eventStep(input.stored),
        ...input.receipts.map((receipt) =>
          receiptStep(receipt, input.receivedAt),
        ),
        {
          statement: 'DELETE FROM event_tags WHERE event_id = ?1;',
          params: [input.event.id],
        },
        ...input.tags.map(tagStep),
        ledgerStep(ledgerRow),
      ],
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok';
}

export async function sqlitePutFeedCursorWithLedger(
  cursor: FeedCursor,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  if (!(await ensureEventGraphSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: [feedCursorStep(cursor), ledgerStep(ledgerRow)],
    },
    { deadlineMs: 3_000 },
  );
  return response.outcome === 'ok';
}

function eventStep(event: StoredEvent): SqlStep {
  return {
    statement:
      'INSERT INTO events (id, pubkey, kind, created_at, content, tags_json, sig, event_json, received_at_ms, relay_urls_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(id) DO UPDATE SET content = excluded.content, tags_json = excluded.tags_json, event_json = excluded.event_json, received_at_ms = excluded.received_at_ms, relay_urls_json = excluded.relay_urls_json;',
    params: [
      event.id,
      event.pubkey,
      event.kind,
      event.created_at,
      event.content,
      JSON.stringify(event.tags),
      event.sig,
      JSON.stringify(event),
      event.receivedAt,
      JSON.stringify(event.relayUrls),
    ],
  };
}

function receiptStep(receipt: EventRelayReceipt, now: number): SqlStep {
  return {
    statement:
      'INSERT INTO event_relays (id, event_id, relay_url, received_at_ms, last_seen_at_ms, seen_count) VALUES (?1, ?2, ?3, ?4, ?5, 1) ON CONFLICT(event_id, relay_url) DO UPDATE SET last_seen_at_ms = excluded.last_seen_at_ms, seen_count = event_relays.seen_count + 1;',
    params: [
      receipt.id,
      receipt.eventId,
      receipt.relayUrl,
      receipt.receivedAt,
      now,
    ],
  };
}

function tagStep(tag: EventTagRow, index: number): SqlStep {
  return {
    statement:
      'INSERT INTO event_tags (id, event_id, tag_index, tag_name, tag_value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET tag_index = excluded.tag_index, tag_value = excluded.tag_value, created_at = excluded.created_at;',
    params: [
      tag.id,
      tag.eventId,
      index,
      tag.tagName,
      tag.tagValue,
      tag.created_at,
    ],
  };
}

function feedCursorStep(cursor: FeedCursor): SqlStep {
  return {
    statement:
      'INSERT INTO feed_cursors (id, feed_key, cursor_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET cursor_json = excluded.cursor_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      cursor.id,
      cursor.feedKey,
      JSON.stringify(cursor),
      cursor.updatedAt,
    ],
  };
}

function ledgerStep(row: CacheLedgerRecord): SqlStep {
  return {
    statement:
      'INSERT INTO cache_ledger (id, owner_kind, resource_kind, resource_id, score, protected, record_json, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO UPDATE SET score = excluded.score, protected = excluded.protected, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.ownerKind,
      row.resourceKind,
      row.resourceId,
      row.score,
      row.protected ? 1 : 0,
      JSON.stringify(row),
      row.createdAt,
      row.updatedAt,
    ],
  };
}
