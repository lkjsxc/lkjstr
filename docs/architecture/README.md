# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Documents

- [event-tree.md](event-tree.md): common event tree rendering model.
- [feed-memory.md](feed-memory.md): bounded feed loading and cache pruning.
- [identity-rendering.md](identity-rendering.md): names and avatars.
- [job-manager.md](job-manager.md): persisted job state and cancellation.
- [profile-runtime.md](profile-runtime.md): profile metadata and notes.
- [query-runtime.md](query-runtime.md): query contracts.
- [relay-pool.md](relay-pool.md): relay client pool.
- [resize.md](resize.md): split resize math.
- [settings-store.md](settings-store.md): flat settings storage.
- [shared-storage.md](shared-storage.md): event and feed repository.
- [storage-workers.md](storage-workers.md): local storage ownership.
- [subscription-manager.md](subscription-manager.md): shared relay reads.
- [system.md](system.md): app boundaries.
- [tab-runtime.md](tab-runtime.md): tab kinds and lifecycle.
- [theme.md](theme.md): visual constraints.
- [thread-runtime.md](thread-runtime.md): thread root and replies.
- [timeline-runtime.md](timeline-runtime.md): home timeline subscriptions.
- [tile-menu.md](tile-menu.md): anchored tile commands.
- [tweet-runtime.md](tweet-runtime.md): draft and publish helpers.
- [ui-composition.md](ui-composition.md): component ownership.
- [workspace-layout-tree.md](workspace-layout-tree.md): recursive layout.
