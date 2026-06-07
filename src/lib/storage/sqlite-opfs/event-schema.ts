import { applySqliteSchema } from './kernel-client';

const eventSchemaHash =
  'event-graph-feed-cache-scan-density-notification-readless';

const eventSchema = [
  'PRAGMA foreign_keys = ON;',
  `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  sig TEXT NOT NULL,
  event_json TEXT NOT NULL,
  received_at_ms INTEGER NOT NULL,
  relay_urls_json TEXT NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS events_kind_created_at_idx ON events(kind, created_at DESC, id DESC);',
  'CREATE INDEX IF NOT EXISTS events_pubkey_kind_created_at_idx ON events(pubkey, kind, created_at DESC, id DESC);',
  'CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at DESC, id DESC);',
  `CREATE TABLE IF NOT EXISTS event_search_tokens (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_pos INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  pubkey TEXT NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS event_search_tokens_lookup_idx ON event_search_tokens(token, created_at DESC, event_id);',
  'CREATE INDEX IF NOT EXISTS event_search_tokens_event_idx ON event_search_tokens(event_id);',
  `CREATE TABLE IF NOT EXISTS event_relays (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  relay_url TEXT NOT NULL,
  received_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER NOT NULL,
  seen_count INTEGER NOT NULL
) STRICT;`,
  'CREATE UNIQUE INDEX IF NOT EXISTS event_relays_event_relay_idx ON event_relays(event_id, relay_url);',
  'CREATE INDEX IF NOT EXISTS event_relays_relay_url_received_at_idx ON event_relays(relay_url, received_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS event_tags (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_index INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;`,
  'CREATE UNIQUE INDEX IF NOT EXISTS event_tags_event_index_idx ON event_tags(event_id, tag_index);',
  'CREATE INDEX IF NOT EXISTS event_tags_lookup_idx ON event_tags(tag_name, tag_value, created_at DESC);',
  `CREATE TABLE IF NOT EXISTS feed_cursors (
  id TEXT PRIMARY KEY,
  feed_key TEXT NOT NULL,
  cursor_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS feed_cursors_feed_key_idx ON feed_cursors(feed_key);',
  `CREATE TABLE IF NOT EXISTS feed_coverage (
  id TEXT PRIMARY KEY,
  feed_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  group_key TEXT NOT NULL,
  status TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  since INTEGER,
  until INTEGER,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS feed_coverage_feed_key_idx ON feed_coverage(feed_key, updated_at_ms DESC);',
  'CREATE INDEX IF NOT EXISTS feed_coverage_lookup_idx ON feed_coverage(feed_key, group_key, relay_url, filter_key, status, since, until);',
  `CREATE TABLE IF NOT EXISTS feed_scan_hints (
  id TEXT PRIMARY KEY,
  scan_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  group_key TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS feed_scan_hints_scan_direction_idx ON feed_scan_hints(scan_key, direction);',
  `CREATE TABLE IF NOT EXISTS feed_scan_observations (
  id TEXT PRIMARY KEY,
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS feed_scan_observations_recent_idx ON feed_scan_observations(created_at_ms DESC, relay_url);',
  `CREATE TABLE IF NOT EXISTS feed_scan_density_models (
  model_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  decays_after_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS feed_scan_density_models_context_idx ON feed_scan_density_models(direction, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, updated_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS feed_scan_decision_traces (
  trace_id TEXT PRIMARY KEY,
  model_key TEXT NOT NULL,
  semantic_feed_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;`,
  `CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  account_pubkey TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  actor_pubkey TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS notifications_account_created_at_idx ON notifications(account_pubkey, created_at DESC);',
  'CREATE INDEX IF NOT EXISTS notifications_source_event_idx ON notifications(source_event_id);',
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
  'CREATE INDEX IF NOT EXISTS cache_ledger_prune_idx ON cache_ledger(protected, score, updated_at_ms);',
];

export async function ensureEventGraphSchema(): Promise<boolean> {
  const response = await applySqliteSchema(eventSchemaHash, eventSchema);
  return response.outcome === 'ok';
}
