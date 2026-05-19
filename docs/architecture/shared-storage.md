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
- Feed cursors are persisted by feed key so cache-first pages and older relay
  pages share one paging model.
- Home, Global, Profile, Thread, and Notifications read feed pages from the
  repository.
- Existing local data may be rebuilt into this shape; no migration promise is
  required for stale browser cache.

## Tables

- `events`: verified Nostr events plus received time and known relay URLs.
- `eventRelays`: one receipt per event and relay URL.
- `feedCursors`: the newest known paging cursor for a feed key.
- `jobs`: persisted in-app job records.
- `notifications`: derived account-scoped activity records.
