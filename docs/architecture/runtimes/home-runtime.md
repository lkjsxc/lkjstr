# Home Runtime

## Purpose

Home runtime owns active-account follow discovery and followed-note loading.

## Render-Critical Kinds

| Phase               | Kinds                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| Bootstrap           | Kind `1` text notes and repost kinds the feed UI renders (`6`, `16` when shown) |
| Live                | Same as bootstrap                                                               |
| Not in feed Demands | Kind `0`, `3`, `10002`, reactions, zaps -- separate Demands or lazy jobs        |

## Lazy Hydration

- Profile metadata: visible and near-visible rows only, cap `30` authors per page.
- Event references: visible-row prefetch per [feed-surface](../data/feed-surface/README.md).
- Follow-list discovery: when cache has no latest kind `3` follows, Home
  performs a bounded follow-list kind `3` relay read across the intended
  discovery relay set. Only after the follow-list read/subscription completes
  is the author set derived and note bootstrap started.
- Route refresh: at most one bounded current-window refresh after discovery.

## Cursor Policy

- **Bootstrap**: adaptive bounded scan on selected + author routes; `limit` per segment;
  closes on `EOSE`; materialize up to `180` rows.
- **Live**: `since` = `max(0, runtimeStartedAt - 30)` for the active account
  read relays.
- **Older**: `page` phase with private scan `until` overlap when needed.
- **Newer**: `page` phase from `newestCursor` when top chunks were pruned.
- Display cursors (`oldestCursor`, `newestCursor`) are UI boundaries; scan cursors may differ.

## Contract

- Load cached kind `3` follows and matching cached display-kind notes first.
- The Rust Home slice builds a typed Home feed view model before Leptos
  rendering. It emits no notes query while follows are loading or absent, and
  consumes the shared feed row view model for event, diagnostic, unavailable,
  and footer rows.
- The Rust shell requests the Home model through a host provider. The provider
  may render cached rows from protected SQLite event repositories, but it keeps
  missing follow-list or coverage proof explicit instead of treating cache miss
  as absence.
- The provider may mark cache complete only when coverage rows match the Home
  feed id, route group, relay URL, semantic filter key, and finite requested
  interval; dense or incomplete rows remain partial retry evidence.
- When cache proof is partial, the Rust provider may publish a later bounded
  relay snapshot into the same `HomeFeedView`. Relay failures with no events
  stay partial or unavailable and must not become an empty success state.
- The Rust Home provider lease is released when the tab body unmounts. Release
  cancels the owner relay read, closes sockets and timers, and suppresses late
  completions.
- Read cached pages through the shared repository.
- For initial, older, and newer note pages, run the cache-first page planner
  before relay reads. Complete coverage returns the SQLite page without relay
  reads; partial coverage renders cached rows and reads only uncovered route
  requirements.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
- Keep Home to a `180` item in-memory window.
- Load older and newer through shared feed surface paging.
- Apply one total request budget across Home author chunks.
- Submit live and page reads through orchestrator intents (`submitLiveIntent`,
  `readPageByIntent`), not raw manager or routing calls. Owner is the tab id.
- Use selected read relays as base and NIP-65 author routes for paging.
  Selected-author fallback route chunks apply only during bootstrap and route
  discovery, not on every older or newer page. See
  [feeds/orchestration-bridge.md](../feeds/orchestration-bridge.md).
- `no-follow-list` emits empty feed with guidance; no self-only notes scan.
- Merge pages through `timeline-reducer`; cache restore uses generation guard.
- Expose runtime status strings including `ready-empty` and `ready-with-events`.
- Close Demands when the primitive runtime key changes or the tab closes.
- Hidden tabs release live Demands; cached window and cursors remain until close.
- Reattach live within `120_000` ms staleness when relays and account unchanged.
- Shared Home startup failures are logged once through app-log with owner,
  surface, kind, tab id, and relay count context.
