# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Tree

- [data/README.md](data/README.md): repository, cache, and event tree model.
- [data/bounded-memory.md](data/bounded-memory.md): bounded memory cleanup.
- [data/event-tree.md](data/event-tree.md): event row tree model.
- [data/event-surface-paging.md](data/event-surface-paging.md): shared feed
  paging and status rows.
- [data/feed-surface.md](data/feed-surface.md): feed list, prefetch, and staged
  rows.
- [data/feed-surface/README.md](data/feed-surface/README.md): feed surface
  index.
- [data/feed-surface/near-end.md](data/feed-surface/near-end.md): near-end
  prefetch.
- [data/feed-surface/footer-phase.md](data/feed-surface/footer-phase.md): footer
  phase reducer.
- [data/feed-surface/staged-pipeline.md](data/feed-surface/staged-pipeline.md):
  staged row pipeline.
- [data/feed-surface/surface-matrix.md](data/feed-surface/surface-matrix.md):
  per-surface list matrix.
- [data/feed-memory.md](data/feed-memory.md): feed windows and scroll anchors.
- [data/retention/README.md](data/retention/README.md): score-based event
  retention.
- [data/retention/compaction.md](data/retention/compaction.md): compaction
  queries.
- [data/retention/index-shape.md](data/retention/index-shape.md): priority index.
- [data/retention/score-policy.md](data/retention/score-policy.md): score rules.
- [data/heap-retention.md](data/heap-retention.md): observed symptoms and
  investigation strategy.
- [data/local-secret-security.md](data/local-secret-security.md):
  passkey-protected local secret storage.
- [data/memory-prioritization.md](data/memory-prioritization.md): durable data
  and runtime retention priority.
- [data/relay-pages.md](data/relay-pages.md): relay page ordering and
  provenance.
- [data/resource-ownership.md](data/resource-ownership.md): who creates and
  who closes each resource.
- [data/shared-storage.md](data/shared-storage.md): shared event storage.
- [data/storage.md](data/storage.md): IndexedDB storage boundaries.
- [network/README.md](network/README.md): relay, identity, jobs, and settings.
- [network/identity-rendering.md](network/identity-rendering.md): identity
  hydration.
- [network/job-manager.md](network/job-manager.md): background jobs.
- [network/relay-pool.md](network/relay-pool.md): WebSocket relay clients.
- [network/relay-routing.md](network/relay-routing.md): protocol-derived read
  routing.
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
- [workspace/pane-chrome-scope.md](workspace/pane-chrome-scope.md): header chrome
  vs body rects for drag hit testing.
- [workspace/pane-drop-target.md](workspace/pane-drop-target.md): pane-body
  drop resolver.
- [workspace/tab-body-mount.md](workspace/tab-body-mount.md): hidden-mount tab
  bodies per pane.
- [workspace/tab-retention-flow.md](workspace/tab-retention-flow.md):
  blur/focus snapshot pipeline.
- [workspace/scroll-layout.md](workspace/scroll-layout.md): scrollbar-safe
  scrolling surfaces.
- [workspace/scroll-surface-audit.md](workspace/scroll-surface-audit.md):
  per-surface scroll checklist.
- [workspace/tab-shell-layout.md](workspace/tab-shell-layout.md): feed-tab vs
  form-tab scroll ownership.
- [workspace/resize.md](workspace/resize.md): resizing.
- [workspace/tile-overlays.md](workspace/tile-overlays.md): tile-scoped
  overlays.
- [workspace/tab-dragging.md](workspace/tab-dragging.md): tab drag zones and
  feedback.
- [workspace/tab-strip-gestures.md](workspace/tab-strip-gestures.md): tab rail
  gestures.
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
