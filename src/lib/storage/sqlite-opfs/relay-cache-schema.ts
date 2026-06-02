import { applySqliteSchema } from './kernel-client';

const relayCacheSchemaHash = 'relay-cache-sqlite-cutover';

const relayCacheSchema = [
  `CREATE TABLE IF NOT EXISTS relay_diagnostic_summaries (
  relay_url TEXT PRIMARY KEY,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS relay_diagnostic_summaries_updated_at_idx ON relay_diagnostic_summaries(updated_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS relay_information (
  relay_url TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  fetched_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS relay_information_fetched_at_idx ON relay_information(fetched_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS relay_list_suggestions (
  id TEXT PRIMARY KEY,
  account_pubkey TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE UNIQUE INDEX IF NOT EXISTS relay_list_suggestions_account_relay_idx ON relay_list_suggestions(account_pubkey, relay_url);',
  `CREATE TABLE IF NOT EXISTS author_relay_routes (
  id TEXT PRIMARY KEY,
  author_pubkey TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  source TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS author_relay_routes_author_idx ON author_relay_routes(author_pubkey, updated_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS relay_route_blocks (
  relay_url TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  reason TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS relay_route_blocks_updated_at_idx ON relay_route_blocks(updated_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS jobs_updated_at_idx ON jobs(updated_at_ms DESC);',
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
];

export async function ensureRelayCacheSchema(): Promise<boolean> {
  const response = await applySqliteSchema(
    relayCacheSchemaHash,
    relayCacheSchema,
  );
  return response.outcome === 'ok';
}
