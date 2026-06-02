# SQLite OPFS Schema

## Purpose

This file mirrors the executable SQLite table set and explains table ownership.
Executable records live in `crates/lkjstr-storage/src/sql/`.

## Rules

- Rust schema records are the executable source of truth.
- This Markdown file lists every table so repository checks can compare docs and
  source.
- Use `STRICT` tables where the bundled SQLite build accepts them.
- Store exact flexible records as JSON text only at explicit boundaries.
- Extract every field needed for sorting, filtering, joining, retention,
  inventory, or diagnostics into indexed columns.
- Enable `PRAGMA foreign_keys = ON` for every connection.

## Protected And Metadata Tables

| Table | Owner | Purpose |
| --- | --- | --- |
| `schema_meta` | storage | schema hash, schema change metadata, and storage flags. |
| `workspaces` | workspace | layout tree, active pane, active tab, and timestamps. |
| `tab_states` | workspace | compact tab snapshots and scroll anchors. |
| `settings` | settings | flat setting overrides by key. |
| `accounts` | accounts | account label, signer kind, and safe metadata. |
| `local_account_secrets` | signer | local secret payload under the current raw-secret contract. |
| `relay_sets` | relays | named relay sets and selected read/write flags. |
| `relay_route_blocks` | relays | protected blocks for unsafe route suggestions. |
| `tweet_drafts` | tweet | durable compose body, attachments, and tags. |

Protected rows are never deleted by cache compaction.

## Event Cache Tables

| Table | Owner | Purpose |
| --- | --- | --- |
| `events` | events | canonical event JSON plus pubkey, kind, time, signature, and content columns. |
| `event_tags` | events | ordered tag rows with lookup columns for references and routing. |
| `event_relays` | events | relay provenance and latest-seen evidence. |
| `notifications` | notifications | materialized account notification rows derived from stored events. |

Indexes:

- `events_by_kind_time`: timeline and kind queries.
- `events_by_pubkey_kind_time`: profile and author queries.
- `event_tags_lookup`: thread, mention, emoji, and route tag lookups.
- `event_relays_by_relay`: relay diagnostics and relay-specific cache reads.
- `notifications_by_owner_time`: notification paging.

## Feed Evidence Tables

| Table | Owner | Purpose |
| --- | --- | --- |
| `feed_cursors` | feeds | semantic cursor rows for older and newer reads. |
| `feed_coverage` | feeds | complete bounded relay/filter evidence for cache-first reads. |
| `feed_scan_hints` | feeds | warm scan span hints that never prove absence. |

Coverage can prove cache-first absence only when every required relay, route
fingerprint, semantic key, filter shape, and bounded interval is complete and
not dense, failed, compacted, unresolved, or stale.

## Jobs And Diagnostics Tables

| Table | Owner | Purpose |
| --- | --- | --- |
| `jobs` | jobs | active and finished publish, upload, and maintenance jobs. |
| `relay_information` | relays | NIP-11 metadata payloads and fetch times. |
| `relay_diagnostic_summaries` | relays | bounded relay diagnostic summaries. |
| `relay_list_suggestions` | relays | explicit NIP-65 suggestions awaiting user import. |
| `author_relay_routes` | relays | route evidence with optional expiry. |
| `app_log` | app | redacted durable app log for storage-backed diagnostics. |

Indexes:

- `feed_coverage_lookup`: cache-first coverage proof.
- `jobs_by_state_updated`: bounded job diagnostics.
- `app_log_by_time`: newest diagnostic rows.

## Ledger Tables

| Table | Owner | Purpose |
| --- | --- | --- |
| `cache_ledger` | storage | byte estimate, protection bit, score, owner, and delete identity. |
| `cache_meta` | storage | pressure, compaction, repair, and inventory bookkeeping. |

Index:

- `cache_ledger_prune`: compaction candidate ordering.

## Search

Local Search is SQL-owned. Use FTS when the bundled SQLite build exposes it. If
FTS is absent, use deterministic indexed SQL filters and `LIKE`; do not fall
back to unbounded JavaScript scans.
