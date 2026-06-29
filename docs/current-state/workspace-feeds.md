# Workspace And Feeds

## Purpose

Workspace, tab, feed, and rust island state.

## Details

Read next: [architecture/workspace/README.md](../architecture/workspace/README.md),
[architecture/feeds/README.md](../architecture/feeds/README.md), and
[architecture/data/feed-surface/README.md](../architecture/data/feed-surface/README.md).

- Pointer tab dragging is canonical. Native desktop drag uses pane chrome
  exclusion and pane-body edge detection for splits.
- Tab rails scroll horizontally with long-press touch drag, pointer capture,
  selection suppression, strip-priority reorder, and active-tab reveal.
- Inactive workspace tabs keep hidden mounted bodies; feed runtimes release live
  demands while retaining bounded windows.
- Tab snapshots are owned by `workspaceId + tabId`. They store compact scroll
  anchors, feed cursors, bounded row ids, and recoverable filter fields. They do
  not store full events, profiles, diagnostics, active workers, or unbounded
  arrays.
- Home, Global, Public Chat, Profile, Thread, Notifications, Search,
  Author Context, Followees, User Timeline, and Custom Request expose scroll-owner shells; Home
  provider updates, live inserts, media/pane-width resize, and event LOD/profile/notification/repost-target
  shell dematerialization preserve anchors. Feed surfaces keep sentinels, footers, viewport-fill, and older-load gates.
- The shipped Rust Home island requests protected SQLite account, relay, follow-list,
  cached event, and feed-coverage evidence, then renders cached rows, exact
  cache-ready proof, durable row-height model estimates for cached rows,
  bounded selected-relay reads, cleanup ownership, and explicit startup storage
  failures. The shipped Rust Global island requests selected-relay cache, exact coverage, kind `1`
  rows, tab-cleanup suppression, footer/scroll older requests, viewport-fill
  older requests, and compound older relay cursors. The shipped Rust Notifications
  island loads SQLite notification records/source events, exact `#p` coverage,
  cache-complete chrome/source rows in one scroll owner that skip initial relay reads,
  empty exact windows, older probes, bounded reads, retained relay state, and a
  runtime-import guard. The shipped Rust Profile island requests selected-relay
  or author-route cache, exact coverage, bounded reads, cleanup, header/follow
  proof, sparse-empty proof, and rejects the retained TypeScript runtime entry.
  The shipped Rust Thread island reads cached root/reply/focused, parent,
  unavailable, continuation, older, and live rows, and rejects its retained runtime entry. Converted Rust rows
  share menus, action/repost rows, non-local Thread row activation, isolated local
  controls, long-token wrapping, User Timeline proof, and cached kind `0` Followees labels/subtitles/avatars with `Unknown` fallback.
- Live inserts use top-anchor policy: top users see new rows immediately; away
  users keep the visible anchor and see newer-available state.
- Profile following counts/actions are explicit: unknown states never render zero;
  known counts open Rust Followees/User Timeline/Edit, copy npub, nprofile,
  follow-list, and relay-set JSON, and non-own Rust follow buttons publish local or
  NIP-07 kind `3` updates only after relay OK; only kind `3` may render `0 following`.
- Profile notes do not show a no-notes empty state until sparse historical relay scans prove absence for attempted routes. Long-inactive profiles remain in a
  loading, searching older, partial, auth-required, failed, or unavailable state
  until proof exists.
- Visibility-prioritized hydration is the feed enrichment policy: visible rows,
  then near-visible rows, then active offscreen work, then hidden diagnostics.
- Public Global, Profile, User Timeline, and Search may use documented session
  default read relays when durable relay settings are unreadable; the UI labels
  the storage problem and only dispatches real read-only WebSocket requests.
- Cache-first feed display requires complete coverage evidence for every
  required relay, route group, semantic key, filter shape, and bounded interval.
  Incomplete, failed, compacted, dense, stale, or missing evidence cannot prove
  absence.
- Rust owns pure feed row geometry estimates, reservation decisions, anchor
  compensation, long-content fragments, target-checked nested-repost rows, a
  real-data feed LOD tree, and owner-release proof that closes wire traffic
  while retaining bounded windows. Svelte feed code uses Rust decisions when
  the bridge is available, with session-only TypeScript estimates as fallback
  only. Typed SQLite row-height observation/model rows and web adapters exist;
  Home, Global, Notifications, Profile, Thread, Search, Author Context, User
  Timeline, and Custom Request use durable models. Stats shows row-height, optimizer, grouped hint-status, and geometry counters. Rules live in
  [architecture/data/feed-surface/height-reservation.md](../architecture/data/feed-surface/height-reservation.md)
  and [architecture/data/feed-surface/lod-tree.md](../architecture/data/feed-surface/lod-tree.md).
