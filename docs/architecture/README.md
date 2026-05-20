# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Tree

- [data/README.md](data/README.md): repository, cache, and event tree model.
- [data/event-tree.md](data/event-tree.md): event row tree model.
- [data/feed-memory.md](data/feed-memory.md): feed windows and scroll anchors.
- [data/shared-storage.md](data/shared-storage.md): shared event storage.
- [data/storage.md](data/storage.md): IndexedDB storage boundaries.
- [network/README.md](network/README.md): relay, identity, jobs, and settings.
- [network/identity-rendering.md](network/identity-rendering.md): identity
  hydration.
- [network/job-manager.md](network/job-manager.md): background jobs.
- [network/relay-pool.md](network/relay-pool.md): WebSocket relay clients.
- [network/settings-store.md](network/settings-store.md): settings storage.
- [network/subscription-manager.md](network/subscription-manager.md): shared
  relay reads.
- [network/system.md](network/system.md): app boundaries.
- [runtimes/README.md](runtimes/README.md): tab runtime data loading.
- [runtimes/global-runtime.md](runtimes/global-runtime.md): Global loading.
- [runtimes/home-runtime.md](runtimes/home-runtime.md): Home loading.
- [runtimes/notifications-runtime.md](runtimes/notifications-runtime.md):
  Notifications loading.
- [runtimes/profile-runtime.md](runtimes/profile-runtime.md): Profile loading.
- [runtimes/query-runtime.md](runtimes/query-runtime.md): query contracts.
- [runtimes/thread-runtime.md](runtimes/thread-runtime.md): Thread loading.
- [runtimes/tweet-runtime.md](runtimes/tweet-runtime.md): Tweet publishing.
- [workspace/README.md](workspace/README.md): layout, tabs, and visual shell.
- [workspace/resize.md](workspace/resize.md): resizing.
- [workspace/tab-runtime.md](workspace/tab-runtime.md): tab lifecycle.
- [workspace/theme.md](workspace/theme.md): theme.
- [workspace/tile-menu.md](workspace/tile-menu.md): tile menus.
- [workspace/ui-composition.md](workspace/ui-composition.md): UI ownership.
- [workspace/workspace-layout-tree.md](workspace/workspace-layout-tree.md):
  layout tree.

## Shared Contract

- Browser runtimes normalize optional persisted fields before UI use.
- Relay diagnostics are session state and are rendered independently from feed
  rows.
- Clean-browser Playwright output is authoritative for app-origin browser
  diagnostics.
