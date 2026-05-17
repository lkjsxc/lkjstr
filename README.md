# lkjstr

`lkjstr` is a browser-first TypeScript Nostr client with an editor-style
split-pane tab workspace.

Treat [docs/README.md](docs/README.md) as the active canon for product
behavior, architecture, operations, and repository policy.

## Start Here

- Canon root: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- Workspace contract: [docs/product/workspace.md](docs/product/workspace.md)
- Tab runtime: [docs/architecture/tab-runtime.md](docs/architecture/tab-runtime.md)
- Timeline runtime: [docs/architecture/timeline-runtime.md](docs/architecture/timeline-runtime.md)
- Profile runtime: [docs/architecture/profile-runtime.md](docs/architecture/profile-runtime.md)
- Settings tab: [docs/product/settings.md](docs/product/settings.md)
- Relay management: [docs/product/relay-management.md](docs/product/relay-management.md)
- Post manager: [docs/product/post-manager.md](docs/product/post-manager.md)
- Architecture: [docs/architecture/README.md](docs/architecture/README.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)
- Repository rules: [docs/repository/README.md](docs/repository/README.md)
- Agent instructions: [AGENTS.md](AGENTS.md)

## Current Shape

- Browser-first SvelteKit and Vite web app.
- Root `/` workspace route.
- Minimal header with `lkjstr` and a build label.
- Editor-style split-pane workspace UI.
- Per-tile plus button for opening a New Tab chooser.
- New Tab chooser converts the tab into the selected tab kind.
- Anchored three-dot tile menu for split and close actions.
- Tiles close automatically when their final tab closes.
- The workspace recovers a new tile when the final tile closes.
- Smart split behavior creates N-way layouts through normal split actions.
- Timeline tabs fetch and render relay events.
- Profile, relay settings, post, account, notification, cache, composer, and
  thread tabs are data-backed surfaces.
- Grouped key-value settings without filtering.
- Dark neutral low-radius theme.
- User-editable default relays.
- IndexedDB cache.
- Vitest and Playwright verification.

## Rule

When implementation and docs diverge, update docs first, then realign code.
