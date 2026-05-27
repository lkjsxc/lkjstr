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
- Follow-list discovery: `purpose: route-discovery` Demand before note bootstrap when cache is empty.
- Route refresh: at most one bounded current-window refresh after discovery.

## Cursor Policy

- **Bootstrap**: adaptive bounded scan on selected + author routes; `limit` per segment;
  closes on `EOSE`; materialize up to `180` rows.
- **Live**: `since` = newest accepted note `created_at` minus `30` s skew.
- **Older**: `page` phase with private scan `until` overlap when needed.
- **Newer**: `page` phase from `newestCursor` when top chunks were pruned.
- Display cursors (`oldestCursor`, `newestCursor`) are UI boundaries; scan cursors may differ.

## Contract

- Load cached kind `3` follows and matching cached kind `1` notes first.
- Read cached pages through the shared repository.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
- Keep Home to a `180` item in-memory window.
- Load older and newer through shared feed surface paging.
- Apply one total request budget across Home author chunks.
- Subscribe to notes through the orchestrator, not raw relay calls.
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
