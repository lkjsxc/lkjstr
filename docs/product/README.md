# Product

## Purpose

Product docs define the visible workspace contract. The first screen is the app
itself: split tiles, tabs, relay-backed data, and local state.

## Table of Contents

- [backlog.md](backlog.md): practical product work with destination docs and
  test strategies.
- [doc-impl-audit.md](doc-impl-audit.md): documentation vs implementation
  alignment matrix.
- [feeds/README.md](feeds/README.md): relay-backed reading surfaces.
- [feeds/global.md](feeds/global.md): Global feed.
- [feeds/home.md](feeds/home.md): Home feed.
- [feeds/notifications.md](feeds/notifications.md): Notifications feed.
- [feeds/profiles.md](feeds/profiles.md): Profile feed.
- [feeds/threads.md](feeds/threads.md): Thread feed.
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
