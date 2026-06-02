import type { Page } from '@playwright/test';
import {
  eventSteps,
  queryEventGraphRows,
  runEventGraphBatch,
} from './sqlite-event-helpers';
import { runSqliteBatch, type SqlStep } from './sqlite-storage-helpers';

export async function seedPressureRows(page: Page) {
  const events = Array.from({ length: 80 }, (_, index) => {
    const id = String(index + 1).repeat(64);
    return eventRow(id, index);
  });
  await seedCacheBudget(page);
  await runEventGraphBatch(page, [
    ...eventSteps(events, ['wss://relay.example']),
    ...events.map((event, index) => ledgerStep(event.id, index)),
  ]);
}

export async function compactPressureRows(page: Page): Promise<void> {
  const eventIds =
    "SELECT resource_id FROM cache_ledger WHERE resource_kind = 'nostr-event' ORDER BY score LIMIT 40";
  await runEventGraphBatch(page, [
    { statement: `DELETE FROM event_relays WHERE event_id IN (${eventIds});` },
    { statement: `DELETE FROM event_tags WHERE event_id IN (${eventIds});` },
    { statement: `DELETE FROM events WHERE id IN (${eventIds});` },
    {
      statement:
        "DELETE FROM cache_ledger WHERE id IN (SELECT id FROM cache_ledger WHERE resource_kind = 'nostr-event' ORDER BY score LIMIT 40);",
    },
  ]);
}

export async function cacheCounts(page: Page) {
  const [eventCount] = await queryEventGraphRows<{ count: number }>(
    page,
    'SELECT COUNT(*) AS count FROM events;',
  );
  const orphanRows = await queryEventGraphRows<{ count: number }>(
    page,
    `SELECT COUNT(*) AS count
     FROM cache_ledger
     WHERE resource_kind = 'nostr-event'
       AND resource_id NOT IN (SELECT id FROM events);`,
  );
  return {
    events: eventCount?.count ?? 0,
    orphanLedgerRows: orphanRows[0]?.count ?? 0,
  };
}

async function seedCacheBudget(page: Page): Promise<void> {
  const now = Date.now();
  const budgetBytes = 1024 * 1024;
  await runSqliteBatch(
    page,
    'e2e-cache-meta',
    [
      `CREATE TABLE IF NOT EXISTS cache_meta (
  id TEXT PRIMARY KEY,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
    ],
    [
      {
        statement:
          'INSERT INTO cache_meta (id, record_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
        params: [
          'main',
          JSON.stringify({ id: 'main', budgetBytes, updatedAt: now }),
          now,
        ],
      },
    ],
  );
}

function eventRow(id: string, index: number) {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at: index + 1,
    kind: 1,
    tags: [['e', `target-${index}`]],
    content: 'x'.repeat(2048),
    sig: 'f'.repeat(128),
  };
}

function ledgerStep(id: string, index: number): SqlStep {
  const row = {
    id: `event:${id}`,
    ownerKind: 'event',
    resourceKind: 'nostr-event',
    resourceId: id,
    score: index,
    createdAt: index + 1,
    updatedAt: Date.now(),
    cacheBytes: 1_000_000,
    protected: false,
  };
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
