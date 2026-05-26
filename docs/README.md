# Docs

## Purpose

This tree is the implementation contract for lkjstr. Use
[current-state.md](current-state.md) as the implemented-state summary, then
follow the product, protocol, architecture, operations, and repository indexes
for detailed contracts.

## Current State

- [current-state.md](current-state.md): implemented app state.

## Architecture

- [architecture/README.md](architecture/README.md): source ownership.
- [architecture/data/README.md](architecture/data/README.md): storage and feed
  memory.
- [architecture/data/bounded-memory.md](architecture/data/bounded-memory.md):
  bounded memory and leak cleanup.
- [architecture/data/memory-prioritization.md](architecture/data/memory-prioritization.md):
  durable data and runtime retention priority.
- [architecture/data/resource-ownership.md](architecture/data/resource-ownership.md):
  resource ownership table.
- [architecture/data/event-tree.md](architecture/data/event-tree.md): event row
  tree model.
- [architecture/data/event-surface-paging.md](architecture/data/event-surface-paging.md):
  shared feed paging and status rows.
- [architecture/data/feed-surface.md](architecture/data/feed-surface.md): feed
  list, prefetch, and staged rows.
- [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md):
  feed surface index.
- [architecture/data/feed-surface/near-end.md](architecture/data/feed-surface/near-end.md):
  near-end prefetch.
- [architecture/data/feed-surface/footer-phase.md](architecture/data/feed-surface/footer-phase.md):
  footer phase reducer.
- [architecture/data/feed-surface/staged-pipeline.md](architecture/data/feed-surface/staged-pipeline.md):
  staged row pipeline.
- [architecture/data/feed-surface/surface-matrix.md](architecture/data/feed-surface/surface-matrix.md):
  per-surface list matrix.
- [architecture/data/feed-surface/feed-scroll-surface.md](architecture/data/feed-surface/feed-scroll-surface.md):
  shared feed scroll shell.
- [architecture/data/feed-surface/feed-row-chrome.md](architecture/data/feed-surface/feed-row-chrome.md):
  list-owned row separators.
- [architecture/data/feed-memory.md](architecture/data/feed-memory.md): feed
  cache and relay windows.
- [architecture/data/retention/README.md](architecture/data/retention/README.md):
  score-based event retention.
- [architecture/data/retention/compaction.md](architecture/data/retention/compaction.md):
  compaction queries.
- [architecture/data/retention/index-shape.md](architecture/data/retention/index-shape.md):
  priority index fields.
- [architecture/data/retention/score-policy.md](architecture/data/retention/score-policy.md):
  score update rules.
- [architecture/data/heap-retention.md](architecture/data/heap-retention.md):
  observed heap symptoms and investigation strategy.
- [architecture/data/local-secret-security.md](architecture/data/local-secret-security.md):
  local secret security boundary.
- [architecture/data/relay-pages.md](architecture/data/relay-pages.md): relay
  page ordering and provenance.
- [architecture/data/shared-storage.md](architecture/data/shared-storage.md):
  shared event storage.
- [architecture/data/storage.md](architecture/data/storage.md): durable storage.
- [architecture/network/README.md](architecture/network/README.md): network
  ownership.
- [architecture/network/identity-rendering.md](architecture/network/identity-rendering.md):
  identity hydration.
- [architecture/network/job-manager.md](architecture/network/job-manager.md):
  background jobs.
- [architecture/network/relay-pool.md](architecture/network/relay-pool.md):
  WebSocket relay clients.
- [architecture/network/relay-routing.md](architecture/network/relay-routing.md):
  protocol-derived read routing.
- [architecture/network/settings-store.md](architecture/network/settings-store.md):
  settings storage.
- [architecture/network/subscription-manager.md](architecture/network/subscription-manager.md):
  shared relay reads.
- [architecture/network/system.md](architecture/network/system.md): app
  boundaries.
- [architecture/runtimes/README.md](architecture/runtimes/README.md): tab
  runtimes.
- [architecture/runtimes/global-runtime.md](architecture/runtimes/global-runtime.md):
  Global loading.
- [architecture/runtimes/home-runtime.md](architecture/runtimes/home-runtime.md):
  Home loading.
- [architecture/runtimes/notifications-runtime.md](architecture/runtimes/notifications-runtime.md):
  Notifications loading.
- [architecture/runtimes/profile-runtime.md](architecture/runtimes/profile-runtime.md):
  Profile loading.
- [architecture/runtimes/query-runtime.md](architecture/runtimes/query-runtime.md):
  query contracts.
- [architecture/runtimes/thread-runtime.md](architecture/runtimes/thread-runtime.md):
  Thread loading.
- [architecture/runtimes/tweet-runtime.md](architecture/runtimes/tweet-runtime.md):
  Tweet publishing.
- [architecture/workspace/README.md](architecture/workspace/README.md):
  workspace modules.
- [architecture/workspace/resize.md](architecture/workspace/resize.md): resizing.
- [architecture/workspace/pane-chrome-scope.md](architecture/workspace/pane-chrome-scope.md):
  pane header chrome for drag scope.
- [architecture/workspace/pane-drop-target.md](architecture/workspace/pane-drop-target.md):
  pane-body drop resolver.
- [architecture/workspace/tab-body-mount.md](architecture/workspace/tab-body-mount.md):
  hidden-mount tab bodies per pane.
- [architecture/workspace/tab-retention-flow.md](architecture/workspace/tab-retention-flow.md):
  tab blur/focus snapshot pipeline.
- [architecture/workspace/scroll-layout.md](architecture/workspace/scroll-layout.md):
  scrollbar-safe scrolling surfaces.
- [architecture/workspace/scroll-surface-audit.md](architecture/workspace/scroll-surface-audit.md):
  per-surface scroll checklist.
- [architecture/workspace/tab-shell-layout.md](architecture/workspace/tab-shell-layout.md):
  feed-tab vs form-tab scroll ownership.
- [architecture/workspace/tile-overlays.md](architecture/workspace/tile-overlays.md):
  tile-scoped overlays.
- [architecture/workspace/tab-dragging.md](architecture/workspace/tab-dragging.md):
  tab drag zones and feedback.
- [architecture/workspace/tab-strip-gestures.md](architecture/workspace/tab-strip-gestures.md):
  tab rail gestures.
- [architecture/workspace/tab-runtime.md](architecture/workspace/tab-runtime.md):
  tab lifecycle.
- [architecture/workspace/theme.md](architecture/workspace/theme.md): theme.
- [architecture/workspace/tile-menu.md](architecture/workspace/tile-menu.md):
  tile menus.
- [architecture/workspace/ui-composition.md](architecture/workspace/ui-composition.md):
  UI ownership.
- [architecture/workspace/workspace-layout-tree.md](architecture/workspace/workspace-layout-tree.md):
  layout tree.

## Decisions

- [decisions/README.md](decisions/README.md): durable decisions.
- [decisions/browser-first.md](decisions/browser-first.md): browser-first
  runtime.
- [decisions/protocol-kernel.md](decisions/protocol-kernel.md): protocol
  boundary.
- [decisions/relay-ownership.md](decisions/relay-ownership.md): user-owned
  relays.

## Operations

- [operations/README.md](operations/README.md): verification and safety.
- [operations/ci.md](operations/ci.md): continuous integration.
- [operations/cloudflare-workers.md](operations/cloudflare-workers.md):
  Cloudflare Workers dry-run target.
- [operations/data-safety.md](operations/data-safety.md): local data safety.
- [operations/diagnostics.md](operations/diagnostics.md): logs and diagnostics.
- [operations/docker.md](operations/docker.md): Docker checks.
- [operations/memory-verification.md](operations/memory-verification.md):
  memory verification workflow.
- [operations/readiness.md](operations/readiness.md): handoff checks.
- [operations/testing-ownership.md](operations/testing-ownership.md): test
  ownership.
- [operations/verification.md](operations/verification.md): local
  verification.

## Product

- [product/README.md](product/README.md): user-facing workspace contract.
- [product/doc-impl-audit.md](product/doc-impl-audit.md): documentation vs
  implementation alignment matrix.
- [product/backlog.md](product/backlog.md): practical backlog with test
  strategies.
- [product/feeds/README.md](product/feeds/README.md): reading surfaces.
- [product/feeds/global.md](product/feeds/global.md): Global feed.
- [product/feeds/home.md](product/feeds/home.md): Home feed.
- [product/feeds/notifications.md](product/feeds/notifications.md):
  Notifications feed.
- [product/feeds/profiles.md](product/feeds/profiles.md): Profile feed.
- [product/feeds/threads.md](product/feeds/threads.md): Thread feed.
- [product/tools/README.md](product/tools/README.md): tools.
- [product/tools/accounts.md](product/tools/accounts.md): accounts.
- [product/tools/author-context.md](product/tools/author-context.md): Author
  Context.
- [product/tools/cache.md](product/tools/cache.md): cache.
- [product/tools/custom-request.md](product/tools/custom-request.md): Custom
  Request.
- [product/tools/event-actions.md](product/tools/event-actions.md): event
  action writes.
- [product/tools/log.md](product/tools/log.md): current-session diagnostics.
- [product/tools/mine-npub.md](product/tools/mine-npub.md): vanity local
  signing key generation.
- [product/tools/profile-edit.md](product/tools/profile-edit.md): active-account
  metadata writes.
- [product/tools/relay-management.md](product/tools/relay-management.md):
  relay management.
- [product/tools/search.md](product/tools/search.md): Search.
- [product/tools/settings.md](product/tools/settings.md): settings.
- [product/tools/stats.md](product/tools/stats.md): Stats.
- [product/tools/tweet.md](product/tools/tweet.md): Tweet tool.
- [product/tools/upload-settings.md](product/tools/upload-settings.md): guided
  media upload settings.
- [product/tools/welcome.md](product/tools/welcome.md): Welcome.
- [product/workspace/README.md](product/workspace/README.md): workspace
  behavior.
- [product/workspace/panes.md](product/workspace/panes.md): panes.
- [product/workspace/scope.md](product/workspace/scope.md): workspace scope.
- [product/workspace/tabs.md](product/workspace/tabs.md): tabs.
- [product/workspace/workflows.md](product/workspace/workflows.md): workflows.
- [product/workspace/workspace.md](product/workspace/workspace.md): workspace.

## Protocol

- [protocol/README.md](protocol/README.md): Nostr contracts.
- [protocol/custom-emoji.md](protocol/custom-emoji.md): NIP-30 custom emoji
  parsing, rendering, and publishing rules.
- [protocol/default-relays.md](protocol/default-relays.md): seeded relays.
- [protocol/event-actions.md](protocol/event-actions.md): event action writes.
- [protocol/events.md](protocol/events.md): events.
- [protocol/kernel.md](protocol/kernel.md): protocol kernel.
- [protocol/media-upload.md](protocol/media-upload.md): NIP-96 upload and
  NIP-98 auth.
- [protocol/nip-support.md](protocol/nip-support.md): NIP support.
- [protocol/relays.md](protocol/relays.md): relays.
- [protocol/zaps.md](protocol/zaps.md): NIP-57 invoice handoff.

## Repository

- [repository/README.md](repository/README.md): layout and workflow rules.
- [repository/documentation-standards.md](repository/documentation-standards.md):
  documentation standards.
- [repository/functional-style.md](repository/functional-style.md): source
  functional style.
- [repository/layout.md](repository/layout.md): repository layout.
- [repository/workflow.md](repository/workflow.md): workflow.

## Research

- [research/README.md](research/README.md): background notes.
- [research/browser-storage.md](research/browser-storage.md): browser storage.
- [research/nostr-client-surfaces.md](research/nostr-client-surfaces.md):
  client surfaces.
- [research/open-questions.md](research/open-questions.md): open questions.

## Vision

- [vision/README.md](vision/README.md): long-term scope.
- [vision/north-star.md](vision/north-star.md): north star.
- [vision/principles.md](vision/principles.md): principles.
- [vision/scope.md](vision/scope.md): scope.

## Canonical Contracts

- [current-state.md](current-state.md): implemented-state summary.
- [product/README.md](product/README.md): user-facing workspace behavior.
- [protocol/README.md](protocol/README.md): Nostr and relay protocol behavior.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
- [operations/README.md](operations/README.md): verification and data safety.
- [repository/README.md](repository/README.md): repository rules.
