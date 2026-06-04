import { cacheByteSizeForEvent } from '../../cache/cache-byte-size';
import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import { eventLedgerRecord } from '../../cache/event-ledger';
import type { EventRelayReceipt, EventTagRow } from '../../events/types';
import { decodeStoredEventRow } from './event-row-codec';
import { ensureEventGraphSchema } from './event-schema';
import { sendSqliteStorage } from './kernel-client';
import type { RepairChunk } from './cache-ledger-repair-rows-sqlite';
import type { SqlRow, SqlScalar } from './types';

export async function sqliteEventRepairChunk(
  cursor: string,
  limit: number,
): Promise<RepairChunk> {
  if (!(await ensureEventGraphSchema())) return unavailableChunk();
  const rows = await queryRows(
    'SELECT id, event_json, relay_urls_json FROM events WHERE id > ?1 ORDER BY id ASC LIMIT ?2;',
    [cursor, limit],
    limit,
  );
  if (!rows) return unavailableChunk();
  const records: CacheLedgerRecord[] = [];
  for (const row of rows) {
    const event = decodeStoredEventRow(row);
    if (!event) continue;
    const [receipts, tags] = await Promise.all([
      eventReceipts(event.id),
      eventTags(event.id),
    ]);
    const draft = eventLedgerRecord(event, tags);
    records.push({
      ...draft,
      cacheBytes: cacheByteSizeForEvent(event, receipts, tags, draft),
    });
  }
  return { rows: records, nextCursor: nextCursor(rows, 'id', limit) };
}

async function eventReceipts(eventId: string): Promise<EventRelayReceipt[]> {
  const rows =
    (await queryRows(
      'SELECT id, event_id, relay_url, received_at_ms FROM event_relays WHERE event_id = ?1 ORDER BY relay_url ASC LIMIT 1000;',
      [eventId],
      1000,
    )) ?? [];
  return rows.map((row) => ({
    id: String(row.id),
    eventId: String(row.event_id),
    relayUrl: String(row.relay_url),
    receivedAt: Number(row.received_at_ms),
  }));
}

async function eventTags(eventId: string): Promise<EventTagRow[]> {
  const rows =
    (await queryRows(
      'SELECT id, event_id, tag_name, tag_value, created_at FROM event_tags WHERE event_id = ?1 ORDER BY tag_index ASC LIMIT 1000;',
      [eventId],
      1000,
    )) ?? [];
  return rows.flatMap((row) => tagRow(row));
}

function tagRow(row: SqlRow): EventTagRow[] {
  const tagName = String(row.tag_name);
  if (!['e', 'p', 'q', 'a'].includes(tagName)) return [];
  return [
    {
      id: String(row.id),
      eventId: String(row.event_id),
      tagName: tagName as EventTagRow['tagName'],
      tagValue: String(row.tag_value),
      created_at: Number(row.created_at),
    },
  ];
}

async function queryRows(
  statement: string,
  params: readonly SqlScalar[],
  rowLimit: number,
): Promise<readonly SqlRow[] | undefined> {
  const response = await sendSqliteStorage({
    kind: 'query',
    statement,
    params,
    rowLimit,
  });
  return response.outcome === 'ok' ? response.rows : undefined;
}

function nextCursor(
  rows: readonly SqlRow[],
  key: string,
  limit: number,
): string | undefined {
  return rows.length >= limit
    ? String(rows[rows.length - 1]?.[key] ?? '')
    : undefined;
}

function unavailableChunk(): RepairChunk {
  return { rows: [], unavailable: true };
}
