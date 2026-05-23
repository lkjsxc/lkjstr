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
- Search, feed, and relay page callers use compound `{createdAt,id}` cursors
  when local ordering needs same-second precision.
- Relay diagnostic summaries, relay information documents, route blocks,
  runtime route evidence, and relay-list suggestions are stored by normalized
  relay URL or account pubkey keys.
- The browser repository reads indexed pages instead of scanning all events.
- Memory fallback keeps a bounded map only for tests and non-browser execution.
- Event compaction prunes by default after `30` days or above `5000` newest
  events.
- Home, Profile, Thread, and Notifications render cache-first, then read from
  selected fallback relays plus bounded route evidence. Global remains selected
  relay based.
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
- `relayDiagnosticSummaries`: per-relay counters, timing, validation, and
  bounded recent diagnostics.
- `relayInformation`: NIP-11 metadata fetch results and fetch errors.
- `relayListSuggestions`: NIP-65 suggestions by account pubkey and relay URL.
- `authorRelayRoutes`: NIP-65, NIP-02, receipt, and discovery route evidence.
- `relayRouteBlocks`: disabled or removed normalized relay URLs.
