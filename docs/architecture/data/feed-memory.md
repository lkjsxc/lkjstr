# Feed Memory

## Purpose

Feed memory rules keep local cache reads, relay backfill, and UI rendering
bounded as timelines grow.

## Contract

- Feed pages request `30` items by default.
- Home, Global, Profile, and Notifications keep at most `180` resident feed
  items per tab across retained chunks.
- Thread tabs keep at most `240` loaded thread items.
- Feed windows keep ordered event ids, an item map, prune metadata, and compound
  oldest/newest cursors.
- Older pages are requested from the bottom boundary cursor.
- Newer pages are requested from the top boundary cursor after top pruning.
- Feed cursors use compound `{ createdAt, id }` ordering so same-second events
  page deterministically.
- Relay feed pages merge duplicate event ids, preserve all relay provenance,
  sort by `{created_at,id}`, and apply `before` or `after` cursor filters
  locally before page slicing.
- Live relay subscriptions set `since` when the runtime starts so old relay
  history is not replayed into the live window.
- Home, Global, and Profile initial or historical relay reads are adaptive
  bounded scans. Each contacted relay must complete a window with EOSE before
  that window can prove there are no matching events there.
- Scanner windows are applied at relay dispatch even when a caller's filter
  builder forgets to copy the provided `since` or `until` bounds.
- Newer relay reads scan from the newest bounded window down toward the current
  top cursor before local compound cursor filtering slices the page.
- A timeout, relay closure, auth requirement, socket close, or socket error
  stops older scanning at that window and keeps `hasMore` conservative.
- Home author chunks share one total page budget. A large follow list must not
  multiply the request limit by chunk count.
- Metadata lookup is scoped to authors currently present in loaded items and is
  capped to `30` missing profiles per loaded page.
- Oversized relay messages above `64 KiB` are rejected before verification,
  storage, or rendering, and are surfaced through relay diagnostics.
- Loading near the bottom adds older chunks. Loading near the top adds newer
  chunks. Rendering flattens chunks only for display.
- Live prepends and chunk changes preserve the visible scroll anchor.
- Virtual event lists include terminal history markers inside the row data, so
  the marker scrolls with loaded content.

## Scroll Anchoring

Feed views capture the visible key and offset before feed changes, then restore
that key after virtual or plain list updates. Virtual lists capture the real
`getScrollOffset` value, skip restoration at offset `0`, and keep live prepends
or older-page loads from moving the visible row.

## Cache Bounds

- IndexedDB is the durable event cache.
- In-memory event maps are a bounded fallback for tests and non-browser
  execution, not the primary browser cache.
- Event indexes support kind/time, author/kind/time, and `e` or `p` tag lookup.
- Local event compaction prunes by age and count from Settings.
- Default compaction limits are `30` days and `5000` events, with numeric
  bounds enforced by the Settings schema.
- Accounts, settings, relay sets, workspace state, notifications, and Tweet
  drafts are protected from event cache pruning.
- Feed cursors are removed when their page boundary no longer points to a
  retained cached event.

## Verification

- The heavy-feed browser smoke test loads thousands of synthetic events and a
  large follow list.
- The app JavaScript heap must stay below `100 MB`.
- Total Chromium process RSS is reported separately because browser baseline
  memory is outside app control.
- The synthetic WebSocket relay emits real signed Nostr events. The smoke test
  checks `performance.memory` when Chromium exposes it.
- Runtime counters keep counts and timestamps only. They do not retain event
  payloads, relay messages, or row objects.
