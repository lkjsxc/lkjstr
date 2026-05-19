# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Tree

```text
architecture/
|-- README.md
|-- event-tree.md
|-- identity-rendering.md
|-- job-manager.md
|-- profile-runtime.md
|-- query-runtime.md
|-- relay-pool.md
|-- resize.md
|-- settings-store.md
|-- shared-storage.md
|-- storage-workers.md
|-- subscription-manager.md
|-- system.md
|-- tab-runtime.md
|-- theme.md
|-- thread-runtime.md
|-- tile-menu.md
|-- timeline-runtime.md
|-- tweet-runtime.md
|-- ui-composition.md
`-- workspace-layout-tree.md
```

## Documents

- [system.md](system.md): app boundaries.
- [tab-runtime.md](tab-runtime.md): tab kinds and lifecycle.
- [timeline-runtime.md](timeline-runtime.md): home timeline subscriptions.
- [profile-runtime.md](profile-runtime.md): profile metadata and notes.
- [thread-runtime.md](thread-runtime.md): thread root and replies.
- [tweet-runtime.md](tweet-runtime.md): draft and publish helpers.
- [relay-pool.md](relay-pool.md): relay client pool.
- [subscription-manager.md](subscription-manager.md): shared relay reads.
- [shared-storage.md](shared-storage.md): event and feed repository.
- [event-tree.md](event-tree.md): common event tree rendering model.
- [job-manager.md](job-manager.md): persisted job state and cancellation.
- [settings-store.md](settings-store.md): flat settings storage.
- [identity-rendering.md](identity-rendering.md): names and avatars.
- [query-runtime.md](query-runtime.md): query contracts.
- [resize.md](resize.md): split resize math.
- [storage-workers.md](storage-workers.md): local storage ownership.
- [workspace-layout-tree.md](workspace-layout-tree.md): recursive layout.
- [tile-menu.md](tile-menu.md): anchored tile commands.
- [ui-composition.md](ui-composition.md): component ownership.
- [theme.md](theme.md): visual constraints.
