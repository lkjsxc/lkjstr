# Shared Storage

## Purpose

Shared storage defines the browser data layer used by feeds, profiles, threads,
notifications, jobs, and relay provenance.

## Contract

- IndexedDB is the durable store, with memory fallback for tests and non-browser
  execution.
- Nostr events are written through one repository before a runtime updates UI
  state.
- Relay provenance is stored separately from the event body as event relay
  receipts.
- Event indexes support kind/time, author/kind/time, and supported tag lookup.
- Event upsert stores `e`, `p`, `q`, and `a` tag rows used by thread,
  reference, reaction, and notification queries.
- Feed cursors are persisted by feed key so cache-first pages and older relay
  pages share one paging model.
- The browser repository reads indexed pages instead of scanning all events.
- Memory fallback keeps a bounded map only for tests and non-browser execution.
- Event compaction prunes by default after `30` days or above `5000` newest
  events.
- Home, Global, Profile, Thread, and Notifications read feed pages from the
  repository.
- Existing local data may be rebuilt into this shape; no migration promise is
  required for stale browser cache.
- Repository reads normalize stale IndexedDB rows before returning them.
- Missing `receivedAt` becomes `0`.
- Missing or empty `relayUrls` becomes `cache` provenance for runtime and UI
  reads.
- Indexed pages, id lookup paths, existing-event reads, and feed conversion use
  the same stored-event normalizer.

## Tables

- `events`: Nostr events plus received time and known relay URLs.
- `eventRelays`: one receipt per event and relay URL.
- `eventTags`: one searchable row per supported `e`, `p`, `q`, or `a` tag.
- `feedCursors`: the newest known paging cursor for a feed key.
- `jobs`: persisted in-app job records.
- `notifications`: derived account-scoped activity records.
