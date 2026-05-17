Owner: `docs/README.md`
State: Canon

# Documentation Canon

`docs/` is the active canon for `lkjstr`.

## Read This Section When

- You need the top-level map.
- You need global repository rules.
- You need the fastest route to a task-specific owner.

## System Goal

- Build a browser-first TypeScript Nostr workspace client.
- Seed editable default relays only when no relay configuration exists.
- Keep protocol, relay, cache, query, worker, account, and UI contracts explicit.
- Keep the editor-style split-pane workspace model central to every product surface.
- Serve the workspace at `/`.
- Keep the workspace usable after every close, split, resize, and tab action.

## Global Rules

1. Keep one canonical owner for each contract.
2. Keep each docs directory to one `README.md` plus multiple children.
3. Keep each docs file at `<= 300` lines.
4. Keep each authored source file at `<= 200` lines.
5. Prefer exact commands, paths, defaults, routes, and payload shapes.
6. Remove conflicting retired behavior instead of preserving it.
7. Change docs first, then implementation, then verification.
8. Optimize for LLM retrieval before human ornament.

## Child Index

- [Current state](current-state.md)
- [Vision](vision/README.md)
- [Product](product/README.md)
- [Protocol](protocol/README.md)
- [Architecture](architecture/README.md)
- [Operations](operations/README.md)
- [Repository](repository/README.md)
- [Decisions](decisions/README.md)
- [Research](research/README.md)

## Task Routes

- Workspace UI: [product/workspace.md](product/workspace.md), [product/panes.md](product/panes.md), [product/tabs.md](product/tabs.md), [architecture/workspace-layout-tree.md](architecture/workspace-layout-tree.md).
- Settings UI: [product/settings.md](product/settings.md), [architecture/settings-store.md](architecture/settings-store.md).
- Theme: [architecture/theme.md](architecture/theme.md).
- Protocol support: [protocol/nip-support.md](protocol/nip-support.md), [protocol/kernel.md](protocol/kernel.md).
- Relay lifecycle: [product/relay-management.md](product/relay-management.md), [architecture/relay-pool.md](architecture/relay-pool.md), [protocol/relays.md](protocol/relays.md), [protocol/default-relays.md](protocol/default-relays.md), [decisions/relay-ownership.md](decisions/relay-ownership.md).
- Timeline runtime: [product/timeline.md](product/timeline.md), [architecture/timeline-runtime.md](architecture/timeline-runtime.md).
- Profile runtime: [product/profiles.md](product/profiles.md), [architecture/profile-runtime.md](architecture/profile-runtime.md).
- Post manager: [product/post-manager.md](product/post-manager.md), [architecture/post-manager.md](architecture/post-manager.md).
- Tile menu and resize: [architecture/tile-menu.md](architecture/tile-menu.md), [architecture/resize.md](architecture/resize.md).
- Tab runtime: [architecture/tab-runtime.md](architecture/tab-runtime.md).
- Storage and workers: [architecture/storage-workers.md](architecture/storage-workers.md).
- Verification: [operations/verification.md](operations/verification.md), [operations/readiness.md](operations/readiness.md).
- Repository rules: [repository/README.md](repository/README.md).
