# Feed Memory

## Purpose

Feed memory rules keep local cache reads, relay backfill, and UI rendering
bounded as timelines grow.

## Contract

- Feed pages request `30` items by default.
- Home, Global, Profile, and Notifications keep at most `180` resident feed
  items per tab across retained chunks and live inserts.
- Thread tabs keep at most `240` loaded thread items, including live inserts.
- Feed windows keep ordered event ids, an item map, prune metadata, and compound
  oldest/newest cursors.
- Older pages are requested from the bottom boundary cursor.
- Newer pages are requested from the top boundary cursor after top pruning.
- Rendered cursors describe visible rows only. Relay scan cursors are private
  runtime cursors and may overlap the visible boundary when relay coverage was
  dense or incomplete.
- Feed cursors use compound `{ createdAt, id }` ordering so same-second events
  page deterministically.
- Relay feed pages merge duplicate event ids, preserve all relay provenance,
  sort by `{created_at,id}`, and apply `before` or `after` cursor filters
  locally before page slicing.
- Live relay subscriptions set `since` when the runtime starts so old relay
  history is not replayed into the live window.
- Orchestration budgets: at most one live lease per compatible Demand fingerprint;
  bootstrap Demands accept only feed-renderable kinds; non-render-critical events
  increment dropped counters instead of expanding feed windows.
- Maximum unresolved author identities for visible-row hydration: `30` per page.
- Maximum unresolved references: bounded by visible-row prefetch coordinator.
- Home, Global, and Profile initial or historical relay reads are adaptive
  bounded scans. Each contacted relay must complete a window with EOSE before
  that window can prove there are no matching events there.
- Scanner windows are applied at relay dispatch even when a caller's filter
  builder forgets to copy the provided `since` or `until` bounds.
- Newer relay reads scan from the newest bounded window down toward the current
  top cursor before local compound cursor filtering slices the page.
- A timeout, relay closure, auth requirement, socket close, or socket error
  stops scanning at the nearest unresolved frontier and keeps `hasMore`
  conservative.
- Dense and incomplete relay ranges do not advance past unproven boundaries.
  Dense ranges retry up to `4x` limits and split; unresolved ranges keep the
  next scan overlapping the safe frontier.
- Historical Home author filters use per-filter relay budgets so large follow
  lists do not starve author chunks. Final display slicing remains local and
  capped by page and window size.
- Relay page reads stop collecting once their event cap is reached and treat
  the affected coverage as incomplete.
- Metadata lookup is scoped to authors currently present in loaded items and is
  capped to `30` missing profiles per loaded page.
- Relay text frames are parsed without an app-imposed byte ceiling. Parse
  failures and unsupported non-text frames are surfaced through relay
  diagnostics before storage or rendering.
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

## Durable Cache vs Runtime Windows

- IndexedDB is the durable event cache. lkjstr does not cap durable cached event
  count by application policy. Browser storage quotas may still limit growth.
- Runtime feed windows (`180` for Home, Global, Profile, Notifications;
  `240` for Thread) bound resident rows per tab, live inserts, and in-memory
  maps. These are not durable cache ceilings.
- In-memory event maps are a bounded fallback for tests and non-browser
  execution, not the primary browser cache.
- Event indexes support kind/time, author/kind/time, and `e` or `p` tag lookup.
- Optional quota-pressure compaction may prune by retention score through the
  indexed `eventPriority` store. See [retention/README.md](retention/README.md).
- Accounts, settings, relay sets, workspace state, notifications, and Tweet
  drafts are protected from event cache pruning.
- Feed cursors are removed when their page boundary no longer points to a
  retained cached event.
- Feed coverage rows store status, reason, limit, event count, unique count,
  attempt, and duration metadata. The memory fallback keeps `500` recent rows.
  Complete coverage compacts sooner than dense, incomplete, unresolved, or
  failed diagnostics.
- Home does not start hidden session backfill when opened. Older history loads
  through scroll-driven or explicit page requests.

## Verification

- The heavy-feed browser smoke test loads thousands of synthetic events and a
  large follow list.
- The app JavaScript heap must stay below `100 MB`.
- Total Chromium process RSS is reported separately because browser baseline
  memory is outside app control.
- The synthetic WebSocket relay emits real signed Nostr events. The smoke test
  checks `performance.memory` when Chromium exposes it.
- Runtime counters keep counts and timestamps only. Segment counters include
  split, grown, dense, unresolved, complete coverage, and incomplete coverage
  counts. They do not retain event payloads, relay messages, or row objects.
- Reference, profile, relay policy, relay info, diagnostic,
  and feed coverage caches use bounded in-memory maps with time-based pruning
  where stale entries can affect routing or presentation.
- Relay snapshots are pulled by diagnostics surfaces only.
- Oversized workspace snapshots are ignored before parsing and recovered from
  durable storage or bootstrap state.
- Runtime factories drop async results after close and release owned
  subscriptions, timers, workers, and DOM listeners.
