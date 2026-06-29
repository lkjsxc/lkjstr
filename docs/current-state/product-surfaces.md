# Product Surfaces

## Purpose

Implemented product surfaces and current user-visible state.

## Details

Read next: [product/README.md](../product/README.md),
[product/workspace/README.md](../product/workspace/README.md), and
[product/tools/README.md](../product/tools/README.md).

- The root route opens the tiled workspace app.
- Clean launch focuses Welcome and opens Accounts, Relay Settings, Home, Notifications, and Tweet.
- Home, Global, Public Chat, Profile, Thread, Notifications, Search, Custom
  Request, Accounts, Relay Settings, Stats, Settings, Upload Settings,
  lkjstr Log, Mine npub, Profile Edit, Welcome, and Rust-island Home, Global,
  Profile, Thread, Notifications, Author Context, Followees, and User Timeline
  bodies are implemented with shared feed/form scroll track-edge alignment.
- Followees/User Timeline Rust islands render real NIP-02 rows,
  selected/stored-route discovery, cleanup, retry, partial/degraded states, and
  real workspace callbacks instead of dummy no-op actions.
- Shared UI system catalog, shipped component list, and polish acceptance rows live
  in [architecture/workspace/ui-system/README.md](../architecture/workspace/ui-system/README.md) and
  [architecture/workspace/ui-system/polish-backlog.md](../architecture/workspace/ui-system/polish-backlog.md).
- New Tab includes a fixed `lkjsxc` choice that opens the public User Timeline
  for `0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d`.
- Search is treated as complete only when the local SQLite token index and
  relay NIP-50 merge tests pass. It must never fall back to full cached-event
  scans for normal local search.
- The old browser storage prompt is removed. Generic workspace tab snapshots
  and protected SQLite data remain; no special durable request feature remains.
  The privacy banner and Privacy settings surface explain essential local-first
  storage; optional cookies, telemetry, and non-essential storage stay disabled
  until consent and can be withdrawn with optional-data cleanup.
- Tweet, replies, reposts, reactions, zaps, Blossom upload, NIP-96
  compatibility upload settings, NIP-98 auth, NIP-30 custom emoji,
  sensitive-content reveal, and event reference previews are implemented.
- Cloudflare Workers Static Assets is only a hosting target. The current path is
  SvelteKit; final Rust/Leptos static cutover requires parity and no-import
  proof. It is not a backend, account service, relay proxy, or storage service.
