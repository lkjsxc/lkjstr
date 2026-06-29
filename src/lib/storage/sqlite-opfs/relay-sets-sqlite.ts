import type { RelaySet } from '../../relays/relay-types';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import { throwIfProtectedStorageBlocked } from '../protected-storage-state';

const relaySetSchemaHash = 'relay-sets-sqlite-cutover';
const relaySetSchema = [
  `CREATE TABLE IF NOT EXISTS relay_sets (
  set_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relays_json TEXT NOT NULL,
  selected_read INTEGER NOT NULL CHECK (selected_read IN (0, 1)),
  selected_write INTEGER NOT NULL CHECK (selected_write IN (0, 1)),
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS relay_sets_updated_at_idx ON relay_sets(updated_at_ms DESC);',
];

export async function sqliteReadRelaySets(): Promise<RelaySet[] | undefined> {
  if (!(await ensureRelaySetSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT relays_json FROM relay_sets ORDER BY updated_at_ms DESC, set_id ASC LIMIT 100;',
      rowLimit: 100,
    },
    { deadlineMs: 3_000 },
  );
  throwIfProtectedStorageBlocked(response);
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeRelaySet(row.relays_json));
}

export async function sqlitePutRelaySets(
  relaySets: readonly RelaySet[],
): Promise<boolean> {
  if (!(await ensureRelaySetSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: relaySets.map((set) => ({
        statement:
          'INSERT INTO relay_sets (set_id, name, relays_json, selected_read, selected_write, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(set_id) DO UPDATE SET name = excluded.name, relays_json = excluded.relays_json, selected_read = excluded.selected_read, selected_write = excluded.selected_write, updated_at_ms = excluded.updated_at_ms;',
        params: [
          set.id,
          set.name,
          JSON.stringify(set),
          set.purpose === 'user' ? 1 : 0,
          set.relays.some((relay) => relay.write) ? 1 : 0,
          set.updatedAt,
        ],
      })),
    },
    { deadlineMs: 5_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

async function ensureRelaySetSchema(): Promise<boolean> {
  const response = await applySqliteSchema(relaySetSchemaHash, relaySetSchema);
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

function decodeRelaySet(raw: unknown): RelaySet[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as RelaySet];
  } catch {
    return [];
  }
}
