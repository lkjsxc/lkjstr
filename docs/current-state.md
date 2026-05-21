# Current State

## Purpose

This document records the current implemented contract for the app.

## State

- Root `/` renders the workspace shell.
- Workspace layout, tab groups, tabs, accounts, relay sets, settings, events,
  notifications, composer recovery data, and cache metadata are local browser
  data.
- Clean first launch opens two equal tiles: Welcome on the left and Accounts,
  Relay Settings, Home, Notifications, and Tweet on the right. New Tab opens
  Home, Tweet, Notifications, Search, Global, Profile Edit, Accounts, Relay
  Settings, Stats, Settings, Upload Settings, lkjstr Log, Mine npub, and
  Welcome.
- Profile tabs open or focus from identity actions in the same tile.
- Profile Edit opens or focuses from own-profile actions in the same tile and
  edits only the active enabled signing account.
- Thread tabs open or focus from event rows, controls, quotes, references, and
  continuation rows in the same tile. Row action buttons never trigger row
  navigation.
- Tabs can be reordered within a tile or moved between tiles with native
  drag-and-drop.
- Moving the last tab out of a tile removes that tile.
- Settings render as one flat key-value list, including cache retention, raw
  string editing, formatted JSON editing, inline JSON import, and raw Tweet
  media upload keys. Notification unread tab badges are not configurable or
  rendered.
- Upload Settings is a guided editor for the Tweet media upload provider,
  custom HTTPS server, no-transform option, endpoint discovery, and discovery
  test result.
- Home is Account home: active account plus NIP-02 follows from the latest
  kind `3` event. Home, Global, and Profile display kinds `1`, `6`, and `16`.
- Home loads cached matching notes first, performs an initial historical relay
  page, then subscribes to enabled read relays in the selected default relay
  set with startup `since`.
- Profile metadata cache is memory-assisted, event-backed, latest-only, and
  runtime-owned for Home and Global timelines.
- Global shows recent notes and reposts from the selected read relays without
  an account requirement.
- Notifications are background-captured relay-backed records derived from
  supported `#p` events that reference the active account. Rows show actor,
  action label, read state, timestamp, and source content without target/root
  context controls. The Notifications tab label never includes an unread count.
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
- Profile renders banner-capable summary, status, then Notes in one tab scroll
  flow.
- Retained inactive tab bodies stay stacked at the active body size so scroll
  position and layout geometry survive tab switches.
- Event metadata shows author control and date.
- Event actions publish NIP-25 hearts and emoji reactions, NIP-18 reposts,
  tagged replies, and NIP-57 zap requests where targets expose zap data.
- Event rows and diagnostic rows wrap long content inside their tile.
- Accounts are managed inline with enable, active, and remove controls. Disabled
  accounts are ignored for signing and active-account resolution.
- Passkey accounts use a stored browser credential to unlock encrypted local
  Nostr key material. Passkeys never sign Nostr events directly, decrypted
  keys stay in memory only, and reloads start locked.
- Mine npub mines an `npub` prefix locally and exports the generated `nsec`
  without storing it until the user adds it.
- Tweet uses the active enabled signing account, durable composer recovery,
  `Ctrl+Enter`, shared provider or custom NIP-96 media upload, NIP-98 upload
  auth, NIP-94 `imeta` tags, and signed kind `1` notes to enabled write relays.
- Sensitive content hides bodies, media, custom emoji images, reference
  previews, and nested repost bodies until locally revealed.
- Custom emoji tags render in event text, nested reposts, reaction summaries,
  profile names, and profile about text when they use HTTPS image URLs.
- Event repository lookup uses direct id reads, batched id reads, and tag-value
  indexes for thread, reference, reaction, and notification reloads.
- Stats shows current-session relay counters, subscription ids, OK counts,
  cache event/profile/notification totals, storage usage, manual refresh, and
  an auto-refresh checkbox.
- Jobs are persisted as root/child trees with progress, output, and cancel
  metadata for inspection in lkjstr Log.
- Docker verification uses `docker-compose.yml` built images with no bind
  mounts or required environment blocks.
- GitHub Actions runs local verification, browser tests, Docker Compose gates,
  and GHCR image publishing on `main`.

## Gaps

- Relay health is visible from live pool snapshots but is not written back.
- lkjstr Log renders job tree inspection before dedicated job controls exist.
