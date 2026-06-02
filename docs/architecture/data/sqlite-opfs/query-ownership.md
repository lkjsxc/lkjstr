# Query Ownership

## Purpose

This file states which data questions belong to SQLite and which state remains
memory-only.

## SQL Owned Queries

The SQLite storage kernel owns cached reads for:

- Home timeline: kind `1` events by followed pubkeys, newest first, cursor by
  `(created_at, event_id)`.
- Global timeline: selected-relay public events, newest first, cursor by
  `(created_at, event_id)`.
- Profile events: author pubkey plus allowed kinds, newest first.
- Thread context: root lookup, parent `e` references, direct replies, reactions,
  reposts, and unavailable missing-event states.
- Notifications: materialized notification rows derived from real stored events.
- Search: cached event content, authors, and tag values, using FTS when present
  and indexed SQL plus `LIKE` when FTS is absent.
- Relay diagnostics: NIP-11 rows, summaries, failed read evidence, and durable
  job diagnostics.
- Relay route evidence: NIP-65 suggestions, event relay receipts, imported
  suggestions, author routes, and route blocks.
- Cache status: table counts, page metrics, ledger rows, pressure state,
  integrity state, and compaction history.

Relay ingress should validate events, commit them to SQLite, then let runtimes
read normalized rows back through repositories. Relay data must not bypass the
storage kernel into unbounded UI arrays.

## Memory Only State

The following state stays outside durable storage:

- Active WebSocket objects.
- Mounted Svelte or Rust UI component state.
- Active drag, resize, pointer-capture, and selection-suppression state.
- Short-lived relay page windows and in-flight progressive snapshots.
- Abort controllers, timeout handles, and close waiters.
- Current-session counters and recent log rings.
- Open popover placement, hover state, and input focus.

Memory-only state must declare a bound, owner, cleanup path, or short lifetime.

## Repository Boundary

Product code calls typed repositories. Repositories choose storage commands and
row codecs. UI code does not send raw SQL, choose indexes, or know whether the
current mode is persistent OPFS or temporary memory.

## Pagination Rule

Visible event pages use cursor tuples. Offset pagination is not acceptable for
Home, Global, Profile, Thread replies, Notifications, or local Search because it
causes duplicate or skipped rows when new events arrive.
