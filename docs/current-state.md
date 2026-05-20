# Current State

## Purpose

This document records the current implemented contract for the app.

## State

- Root `/` renders the workspace shell.
- Workspace layout, tab groups, tabs, accounts, relay sets, settings, events,
  notifications, Tweet drafts, and cache metadata are local browser data.
- New Tab opens Home, Global, Relay Settings, lkjstr Log, Notifications,
  Accounts, Tweet, Settings, and Cache.
- Profile tabs open or focus from identity actions in the same tile.
- Thread tabs open or focus from event rows, controls, quotes, references, and
  continuation rows in the same tile. Row action buttons never trigger row
  navigation.
- Tabs can be reordered within a tile or moved between tiles with native
  drag-and-drop.
- Moving the last tab out of a tile removes that tile.
- Settings render as one flat key-value list, including cache retention and
  Tweet media upload controls.
- Home is Account home: active account plus NIP-02 follows from the latest
  kind `3` event.
- Home loads cached matching notes first, performs an initial historical relay
  page, then subscribes to enabled read relays in the selected default relay
  set with startup `since`.
- Profile metadata cache is memory-assisted, event-backed, and latest-only.
- Global shows recent kind `1` notes from the selected read relays without an
  account requirement.
- Notifications are relay-backed records derived from events that reference the
  active account.
- Home has no hidden public fallback when the selected account or read relays
  cannot produce a feed.
- Feed loading ends when cache exists, any relay produces events, any relay
  reaches EOSE, or all contacted relays fail or close.
- Home states are `no-active-account`, `loading-follows`, `no-follow-list`,
  `no-enabled-relay`, `auth-required`, `subscription-closed`, `relay-failed`,
  `ready-empty`, and `ready-with-events`.
- Relay Settings shows editable relay state and lkjstr Log shows
  current-session app diagnostics as a flat chronological stream.
- Feed memory is held as resident chunks. The top of a pruned feed loads newer
  chunks, and the bottom or a short viewport loads older chunks.
- Profile renders summary, status, then Notes in one tab scroll flow.
- Retained inactive tab bodies stay stacked at the active body size so scroll
  position and layout geometry survive tab switches.
- Event metadata shows author control and date.
- Event actions publish NIP-25 hearts and emoji reactions, NIP-18 reposts,
  tagged replies, and NIP-57 zap requests where targets expose zap data.
- Event rows and diagnostic rows wrap long content inside their tile.
- Accounts can mine an `npub` prefix locally and export the generated `nsec`
  without storing it.
- Tweet uses durable draft storage, `Ctrl+Enter`, optional NIP-96 media upload,
  NIP-98 upload auth, NIP-94 `imeta` tags, and NIP-07 signed kind `1` notes to
  enabled write relays.
- Docker verification uses `docker-compose.yml` built images with no bind
  mounts or required environment blocks.
- GitHub Actions runs local verification, browser tests, Docker Compose gates,
  and GHCR image publishing on `main`.

## Gaps

- Relay health is visible from live pool snapshots but is not written back.
- Long-running local work should expose progress and cancellation.
