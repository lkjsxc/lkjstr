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
- Live relay subscriptions set `since` when the runtime starts so old relay
  history is not replayed into the live window.
- Historical relay reads are one-shot `REQ` pages with bounded `limit`; they
  close on EOSE, terminal relay state, or timeout.
- Home author chunks share one total page budget. A large follow list must not
  multiply the request limit by chunk count.
- Metadata lookup is scoped to authors currently present in loaded items and is
  capped to `30` missing profiles per loaded page.
- Oversized relay messages above `64 KiB` are rejected before verification,
  storage, or rendering, and are surfaced through relay diagnostics.
- Loading near the bottom adds older chunks. Loading near the top adds newer
  chunks. Rendering flattens chunks only for display.
- Live prepends and chunk changes preserve the visible scroll anchor.

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
