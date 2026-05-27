# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Tree

- [backend/README.md](backend/README.md): browser-local backend services.
- [backend/boundary.md](backend/boundary.md): local backend boundary.
- [backend/cache-budget.md](backend/cache-budget.md): cache byte budget.
- [backend/home-query-lifecycle.md](backend/home-query-lifecycle.md):
  shared Home queries.
- [backend/query-registry.md](backend/query-registry.md): query ownership.
- [backend/transport-contract.md](backend/transport-contract.md):
  local transport.
- [feeds/README.md](feeds/README.md): feed sources, invariants, merge, cursors.
- [feeds/invariants/README.md](feeds/invariants/README.md): ordering, paging,
  filter safety.
- [feeds/invariants/event-ordering.md](feeds/invariants/event-ordering.md):
  canonical sort keys.
- [feeds/invariants/filter-safety.md](feeds/invariants/filter-safety.md):
  protocol-safe filters.
- [feeds/invariants/paging-cursors.md](feeds/invariants/paging-cursors.md):
  cursor fields and bounds.
- [feeds/sources/README.md](feeds/sources/README.md): Home, Global, Profile,
  Notifications filter semantics.
- [feeds/sources/home.md](feeds/sources/home.md): Home follow discovery.
- [feeds/sources/global.md](feeds/sources/global.md): Global firehose filters.
- [feeds/sources/notifications.md](feeds/sources/notifications.md):
  notification `#p` filters.
- [feeds/sources/profile.md](feeds/sources/profile.md): profile note filters.
- [feeds/runtime/README.md](feeds/runtime/README.md): merge reducer, cursors,
  multi-tab ownership.
- [feeds/runtime/merge-reducer.md](feeds/runtime/merge-reducer.md): merge-by-id.
- [feeds/runtime/multi-tab-ownership.md](feeds/runtime/multi-tab-ownership.md):
  per-tab runtime keys.
- [feeds/runtime/per-runtime-cursors.md](feeds/runtime/per-runtime-cursors.md):
  page cursors per tab.
- [feeds/runtime/relay-incomplete-windows.md](feeds/runtime/relay-incomplete-windows.md):
  incomplete relay windows.
- [feeds/orchestration-bridge.md](feeds/orchestration-bridge.md): planner bridge.
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
- [data/feed-surface/older-load-mode.md](data/feed-surface/older-load-mode.md):
  older paging intent gating.
- [data/feed-surface/footer-phase.md](data/feed-surface/footer-phase.md): footer
  phase reducer.
- [data/feed-surface/staged-pipeline.md](data/feed-surface/staged-pipeline.md):
  staged row pipeline.
- [data/feed-surface/surface-matrix.md](data/feed-surface/surface-matrix.md):
  per-surface list matrix.
- [data/feed-surface/feed-scroll-surface.md](data/feed-surface/feed-scroll-surface.md):
  shared feed scroll shell.
- [data/feed-surface/feed-row-chrome.md](data/feed-surface/feed-row-chrome.md):
  list-owned row separators.
- [data/feed-surface/event-value.md](data/feed-surface/event-value.md):
  visible event value and retention.
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
- [network/subscription-orchestration/README.md](network/subscription-orchestration/README.md):
  Demand and Lease orchestration index.
- [network/subscription-orchestration/demand-intent.md](network/subscription-orchestration/demand-intent.md):
  intent shapes and owner keys.
- [network/subscription-orchestration/home-integration.md](network/subscription-orchestration/home-integration.md):
  Home bootstrap, live, and paging.
- [network/subscription-orchestration/ingress.md](network/subscription-orchestration/ingress.md):
  live event classification.
- [network/subscription-orchestration/lease-key.md](network/subscription-orchestration/lease-key.md):
  wire-equivalent fingerprints.
- [network/subscription-orchestration/live-lease.md](network/subscription-orchestration/live-lease.md):
  lease refcount and visibility.
- [network/subscription-orchestration/metrics.md](network/subscription-orchestration/metrics.md):
  orchestration counters.
- `network/subscription-orchestration/notifications-profile-thread-integration.md`:
  other feed surfaces.
- [network/subscription-orchestration/owner-visibility.md](network/subscription-orchestration/owner-visibility.md):
  hidden tab behavior.
- [network/subscription-orchestration/page-read-dedupe.md](network/subscription-orchestration/page-read-dedupe.md):
  semantic page keys.
- [network/subscription-orchestration/route-plan.md](network/subscription-orchestration/route-plan.md):
  route planning.
- [network/subscription-orchestration/tests.md](network/subscription-orchestration/tests.md):
  verification gates.
- [network/subscription-orchestration/compatibility.md](network/subscription-orchestration/compatibility.md):
  Demand merge rules.
- [network/subscription-orchestration/routing-by-surface.md](network/subscription-orchestration/routing-by-surface.md):
  per-surface relay routes.
- [network/subscription-orchestration/source-map.md](network/subscription-orchestration/source-map.md):
  implementation modules.
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
- [workspace/tab-snapshot-fields.md](workspace/tab-snapshot-fields.md):
  compact tab snapshot payloads.
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
