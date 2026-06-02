import type { Page } from '@playwright/test';
import {
  querySqliteRows,
  runSqliteBatch,
  type SqlRow,
  type SqlStep,
} from './sqlite-storage-helpers';

const eventGraphSchemaHash = 'event-graph-feed-cache-coverage-lookup';
const eventGraphSchema = [
  'PRAGMA foreign_keys = ON;',
  'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, kind INTEGER NOT NULL, created_at INTEGER NOT NULL, content TEXT NOT NULL, tags_json TEXT NOT NULL, sig TEXT NOT NULL, event_json TEXT NOT NULL, received_at_ms INTEGER NOT NULL, relay_urls_json TEXT NOT NULL) STRICT;',
  'CREATE TABLE IF NOT EXISTS event_relays (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, relay_url TEXT NOT NULL, received_at_ms INTEGER NOT NULL, last_seen_at_ms INTEGER NOT NULL, seen_count INTEGER NOT NULL) STRICT;',
  'CREATE TABLE IF NOT EXISTS event_tags (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, tag_index INTEGER NOT NULL, tag_name TEXT NOT NULL, tag_value TEXT NOT NULL, created_at INTEGER NOT NULL) STRICT;',
  'CREATE TABLE IF NOT EXISTS feed_coverage (id TEXT PRIMARY KEY, feed_key TEXT NOT NULL, relay_url TEXT NOT NULL, group_key TEXT NOT NULL, status TEXT NOT NULL, filter_key TEXT NOT NULL, since INTEGER, until INTEGER, record_json TEXT NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT;',
  'CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, account_pubkey TEXT NOT NULL, source_event_id TEXT NOT NULL, actor_pubkey TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER, record_json TEXT NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT;',
  'CREATE TABLE IF NOT EXISTS cache_ledger (id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL, resource_kind TEXT NOT NULL, resource_id TEXT NOT NULL, score INTEGER NOT NULL, protected INTEGER NOT NULL CHECK (protected IN (0, 1)), record_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT;',
];

export async function runEventGraphBatch(
  page: Page,
  steps: readonly SqlStep[],
): Promise<void> {
  await runSqliteBatch(page, eventGraphSchemaHash, eventGraphSchema, steps);
}

export function queryEventGraphRows<T extends SqlRow>(
  page: Page,
  statement: string,
  params: readonly unknown[] = [],
  rowLimit = 1000,
): Promise<T[]> {
  return querySqliteRows<T>(
    page,
    eventGraphSchemaHash,
    eventGraphSchema,
    statement,
    params,
    rowLimit,
  );
}

export function eventSteps(
  events: readonly Record<string, unknown>[],
  relayUrls: readonly string[] = ['wss://synthetic.test'],
): SqlStep[] {
  const receivedAt = Date.now();
  return events.flatMap((event) => oneEventSteps(event, relayUrls, receivedAt));
}

export function feedCoverageStep(row: Record<string, unknown>): SqlStep {
  return {
    statement:
      'INSERT INTO feed_coverage (id, feed_key, relay_url, group_key, status, filter_key, since, until, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(id) DO UPDATE SET status = excluded.status, filter_key = excluded.filter_key, since = excluded.since, until = excluded.until, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.feedKey,
      row.relayUrl,
      row.groupKey,
      row.status,
      row.filterKey,
      row.since ?? null,
      row.until ?? null,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

export function notificationStep(row: Record<string, unknown>): SqlStep {
  return {
    statement:
      'INSERT INTO notifications (id, account_pubkey, source_event_id, actor_pubkey, kind, created_at, read_at, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO UPDATE SET read_at = excluded.read_at, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.accountPubkey,
      row.sourceEventId,
      row.actorPubkey,
      row.kind,
      row.createdAt,
      row.readAt,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

function oneEventSteps(
  event: Record<string, unknown>,
  relayUrls: readonly string[],
  receivedAt: number,
): SqlStep[] {
  const id = String(event.id);
  const tags = tagList(event.tags);
  return [
    eventStep(event, id, tags, relayUrls, receivedAt),
    { statement: 'DELETE FROM event_tags WHERE event_id = ?1;', params: [id] },
    ...tags.flatMap((tag, index) => tagStep(id, tag, index, event)),
    ...relayUrls.map((relayUrl) => relayStep(id, relayUrl, receivedAt)),
  ];
}

function eventStep(
  event: Record<string, unknown>,
  id: string,
  tags: readonly string[][],
  relayUrls: readonly string[],
  receivedAt: number,
): SqlStep {
  return {
    statement:
      'INSERT INTO events (id, pubkey, kind, created_at, content, tags_json, sig, event_json, received_at_ms, relay_urls_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(id) DO UPDATE SET content = excluded.content, tags_json = excluded.tags_json, event_json = excluded.event_json, received_at_ms = excluded.received_at_ms, relay_urls_json = excluded.relay_urls_json;',
    params: [
      id,
      String(event.pubkey),
      Number(event.kind),
      Number(event.created_at),
      String(event.content ?? ''),
      JSON.stringify(tags),
      String(event.sig),
      JSON.stringify({ ...event, tags, receivedAt, relayUrls }),
      receivedAt,
      JSON.stringify(relayUrls),
    ],
  };
}

function tagStep(
  eventId: string,
  tag: readonly string[],
  index: number,
  event: Record<string, unknown>,
): SqlStep[] {
  const tagName = tag[0];
  const tagValue = tag[1];
  if (!tagName || !tagValue) return [];
  return [
    {
      statement:
        'INSERT INTO event_tags (id, event_id, tag_index, tag_name, tag_value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET tag_index = excluded.tag_index, tag_value = excluded.tag_value, created_at = excluded.created_at;',
      params: [
        `${eventId}:${index}`,
        eventId,
        index,
        tagName,
        tagValue,
        Number(event.created_at),
      ],
    },
  ];
}

function relayStep(
  eventId: string,
  relayUrl: string,
  receivedAt: number,
): SqlStep {
  return {
    statement:
      'INSERT INTO event_relays (id, event_id, relay_url, received_at_ms, last_seen_at_ms, seen_count) VALUES (?1, ?2, ?3, ?4, ?5, 1) ON CONFLICT(id) DO UPDATE SET last_seen_at_ms = excluded.last_seen_at_ms, seen_count = event_relays.seen_count + 1;',
    params: [
      `${eventId}:${relayUrl}`,
      eventId,
      relayUrl,
      receivedAt,
      receivedAt,
    ],
  };
}

function tagList(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStringArray);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
