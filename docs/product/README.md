# Product

## Purpose

Product docs define the visible workspace contract. The first screen is the app
itself: split tiles, tabs, relay-backed data, and local state.

## Table of Contents

- [backlog.md](backlog.md): practical product work with destination docs and
  test strategies.
- [doc-impl-audit.md](doc-impl-audit.md): documentation vs implementation
  alignment matrix.
- [audit/README.md](audit/README.md): executable detail for partial audit rows.
- [audit/rust-wasm-target.md](audit/rust-wasm-target.md): Rust/WASM source paths
  and closing gates.
- [audit/product-polish.md](audit/product-polish.md): backlog source paths and
  focused gates.
- [audit/verification-gaps.md](audit/verification-gaps.md): focused audit gates.
- [feeds/README.md](feeds/README.md): relay-backed reading surfaces.
- [feeds/followees.md](feeds/followees.md): viewed-profile following list.
- [feeds/global.md](feeds/global.md): Global feed.
- [feeds/home.md](feeds/home.md): Home feed.
- [feeds/notifications.md](feeds/notifications.md): Notifications feed.
- [feeds/post-display.md](feeds/post-display.md): shared real-post row display.
- [feeds/profiles.md](feeds/profiles.md): Profile feed.
- [feeds/public-chat.md](feeds/public-chat.md): Public Chat channel surface.
- [feeds/threads.md](feeds/threads.md): Thread feed.
- [feeds/user-timeline.md](feeds/user-timeline.md): public follow-graph timeline.
- [privacy/README.md](privacy/README.md): consent, optional categories, and
  privacy settings.
- [privacy/consent.md](privacy/consent.md): first-run privacy banner.
- [privacy/settings.md](privacy/settings.md): withdrawal and optional-data cleanup.
- [tools/README.md](tools/README.md): local tools and settings surfaces.
- [tools/accounts.md](tools/accounts.md): account records and signers.
- [tools/author-context.md](tools/author-context.md): nearby posts by an event
  author.
- [tools/cache.md](tools/cache.md): local cache behavior surfaced through
  Stats and settings.
- [tools/custom-request.md](tools/custom-request.md): validated one-shot relay
  reads.
- [tools/event-actions.md](tools/event-actions.md): event action writes.
- [tools/log.md](tools/log.md): current-session diagnostics.
- [tools/mine-npub.md](tools/mine-npub.md): vanity local signing key
  generation.
- [tools/profile-edit.md](tools/profile-edit.md): active-account metadata
  writes.
- [tools/relay-management.md](tools/relay-management.md): relay management.
- [tools/search.md](tools/search.md): local and relay-backed search.
- [tools/settings.md](tools/settings.md): settings.
- [tools/stats.md](tools/stats.md): relay, cache, job, and runtime summaries.
- [tools/tweet.md](tools/tweet.md): Tweet tool.
- [tools/upload-settings.md](tools/upload-settings.md): guided media upload
  settings.
- [tools/welcome.md](tools/welcome.md): startup readiness status.
- [workspace/README.md](workspace/README.md): tiles, panes, tabs, and flows.
- [workspace/panes.md](workspace/panes.md): panes.
- [workspace/scope.md](workspace/scope.md): workspace scope.
- [workspace/tabs.md](workspace/tabs.md): tabs.
- [workspace/workflows.md](workspace/workflows.md): workflows.
- [workspace/workspace.md](workspace/workspace.md): workspace.

## Shared Surface Rules

- Every tab fits inside its tile without horizontal pane scrolling.
- Tab bodies own the full available tile height so split panes do not collapse
  feed lists.
- Long URLs, event ids, public keys, relay messages, code, labels, and note
  content wrap inside their visible container.
- Action-opened Profile and Thread tabs inherit the clicked tile context.
- A clean first launch opens Welcome, not Home.

## All Files

```text
`audit/README.md` `audit/product-polish.md` `audit/rust-wasm-target.md` `audit/verification-gaps.md` `backlog.md` `doc-impl-audit.md` `feeds/README.md`
`feeds/followees.md` `feeds/global.md` `feeds/home.md` `feeds/notifications.md` `feeds/post-display.md` `feeds/profiles.md` `feeds/public-chat.md` `feeds/threads.md`
`feeds/user-timeline.md` `privacy/README.md` `privacy/consent.md` `privacy/settings.md` `tools/README.md` `tools/accounts.md` `tools/author-context.md` `tools/cache.md` `tools/custom-request.md` `tools/event-actions.md`
`tools/log.md` `tools/mine-npub.md` `tools/profile-edit.md` `tools/relay-management.md` `tools/search.md` `tools/settings.md` `tools/stats.md`
`tools/tweet.md` `tools/upload-settings.md` `tools/welcome.md` `workspace/README.md` `workspace/panes.md` `workspace/scope.md` `workspace/tabs.md`
`workspace/workflows.md` `workspace/workspace.md`
```
