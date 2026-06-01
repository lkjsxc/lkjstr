# SQLite OPFS Schema

## Purpose

This file defines the canonical SQLite table set. Status: design target until
the Rust executable schema records are committed.

## Schema Rules

- Rust schema records are the executable source of truth.
- Markdown mirrors generated records and must be checked by `lkjstr-xtask`.
- Use `STRICT` tables where the bundled SQLite build accepts them.
- Store flexible payloads as JSON text only at clear boundaries.
- Normalize high-volume paths for events, tags, relay provenance, coverage,
  scan hints, notifications, route evidence, diagnostics, and ledger rows.
- Enable `PRAGMA foreign_keys = ON` for every connection.

## Protected User Data

| Table | Primary key | Contract |
| --- | --- | --- |
| `schema_meta` | `key` | schema hash, migration metadata, and app storage flags |
| `workspaces` | `workspace_id` | layout, active pane, active tab |
| `tab_states` | `workspace_id`, `tab_id` | compact tab snapshots and scroll anchors |
| `settings` | `key` | flat user settings |
| `accounts` | `pubkey` | account label, signer kind, metadata |
| `local_account_secrets` | `pubkey` | raw local signing secret payload under the current raw-secret contract |
| `relay_sets` | `set_id` | named relay set and selected read/write flags |
| `relay_route_blocks` | `relay_url`, `pubkey` | user blocks for route suggestions |
| `tweet_drafts` | `draft_id` | durable compose body, attachments, and tags |

Protected rows are never removed by cache compaction.

## Event Cache

| Table | Primary key | Contract |
| --- | --- | --- |
| `events` | `event_id` | canonical raw event JSON plus normalized identity fields |
| `event_tags` | `event_id`, `tag_index` | ordered tags with lookup columns |
| `event_relays` | `event_id`, `relay_url` | relay provenance and source kind |
| `notifications` | `notification_id` | owner-indexed notification rows |

Required indexes:

- `events_by_kind_time` on kind, descending created time, event id.
- `events_by_pubkey_kind_time` on pubkey, kind, descending created time, event id.
- `event_tags_lookup` on tag name, first value, event id.
- `event_relays_by_relay` on relay URL and latest seen time.
- `notifications_by_owner_time` on owner, descending created time, id.

## Feed Evidence

| Table | Primary key | Contract |
| --- | --- | --- |
| `feed_cursors` | `cursor_id` | semantic feed cursor by direction |
| `feed_coverage` | `coverage_id` | complete bounded relay/filter evidence |
| `feed_scan_hints` | `hint_id` | warm scan span hints that never prove absence |

Coverage rows can prove cache-first absence only when every required relay,
filter fingerprint, semantic feed key, and bounded interval is complete and not
compacted, failed, dense, unresolved, or missing.

## Diagnostics And Jobs

| Table | Primary key | Contract |
| --- | --- | --- |
| `jobs` | `job_id` | protected active jobs and compactable finished jobs |
| `relay_information` | `relay_url` | NIP-11 metadata payloads |
| `relay_diagnostic_summaries` | `relay_url` | bounded relay diagnostics |
| `relay_list_suggestions` | `pubkey`, `relay_url`, `purpose` | explicit NIP-65 suggestions |
| `author_relay_routes` | `pubkey`, `relay_url`, `route_kind` | route evidence with optional expiry |
| `app_log` | `log_id` | redacted chronological app log |

Required indexes:

- `jobs_by_state_updated` on state and descending update time.
- `app_log_by_time` on descending creation time and id.

## Ledger And Metadata

| Table | Primary key | Contract |
| --- | --- | --- |
| `cache_ledger` | `resource_id` | byte estimate, protection bit, score, owner key |
| `cache_meta` | `key` | retention metadata and pressure bookkeeping |

Required index:

- `cache_ledger_prune` on protection, score, and update time.

## Search

Local Search must not be an unbounded in-memory scan. If the bundled SQLite
build includes FTS, add an FTS table linked to `events(event_id)`. If FTS is
unavailable, use deterministic lowercase token rows owned by `lkjstr-storage`.

