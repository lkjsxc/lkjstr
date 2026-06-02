import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { CacheMetadata } from '../../cache/cache-status';
import { applySqliteSchema } from './kernel-client';
import {
  sqliteRecordBatch,
  sqliteRecordReadMany,
  sqliteRecordReadOne,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

const cacheLedgerSchemaHash = 'cache-ledger-sqlite-cutover';
const cacheLedgerSchema = [
  `CREATE TABLE IF NOT EXISTS cache_ledger (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  protected INTEGER NOT NULL CHECK (protected IN (0, 1)),
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS cache_ledger_score_idx ON cache_ledger(score, updated_at_ms);',
  `CREATE TABLE IF NOT EXISTS cache_meta (
  id TEXT PRIMARY KEY,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
];

export function sqliteReadCacheLedgerRows(): Promise<
  CacheLedgerRecord[] | undefined
> {
  return sqliteRecordReadMany<CacheLedgerRecord>(
    ensureCacheLedgerSchema,
    'cache_ledger',
    '1 = 1 ORDER BY score ASC, updated_at_ms ASC',
    [],
    100_000,
  );
}

export function sqliteReadCacheMeta(
  id: string,
): Promise<CacheMetadata | undefined> {
  return sqliteRecordReadOne<CacheMetadata>(
    ensureCacheLedgerSchema,
    'cache_meta',
    'id = ?1',
    [id],
  );
}

export function sqlitePutCacheMeta(meta: CacheMetadata): Promise<boolean> {
  return sqliteRecordBatch(ensureCacheLedgerSchema, [cacheMetaStep(meta)]);
}

async function ensureCacheLedgerSchema(): Promise<boolean> {
  const response = await applySqliteSchema(
    cacheLedgerSchemaHash,
    cacheLedgerSchema,
  );
  return response.outcome === 'ok';
}

function cacheMetaStep(meta: CacheMetadata): SqlStep {
  return {
    statement:
      'INSERT INTO cache_meta (id, record_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [meta.id, JSON.stringify(meta), meta.updatedAt],
  };
}
