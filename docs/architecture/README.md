# Architecture Canon

Owner: Architecture
State: Canon

## Purpose

This directory defines the browser architecture for the SvelteKit Nostr workspace client. These docs are canonical for module boundaries, runtime ownership, storage, workers, and UI composition.

## Documents

- [system.md](system.md): high-level runtime and ownership boundaries.
- [storage-workers.md](storage-workers.md): IndexedDB and worker model.
- [ui-composition.md](ui-composition.md): workspace, pane, and state composition.
- [workspace-layout-tree.md](workspace-layout-tree.md): recovery and smart split rules.
- [tab-runtime.md](tab-runtime.md): tab kind registration and conversion rules.
- [tile-menu.md](tile-menu.md): anchored menu behavior.
- [resize.md](resize.md): split resize sensitivity.
- [timeline-runtime.md](timeline-runtime.md): timeline cache, relay, and UI flow.
- [profile-runtime.md](profile-runtime.md): profile metadata and post loading.
- [post-manager.md](post-manager.md): local post draft storage and tree runtime.
- [relay-pool.md](relay-pool.md): relay pool ownership and subscription rules.
- [settings-store.md](settings-store.md): settings schema and persistence.
- [theme.md](theme.md): dark neutral low-radius styling contract.
