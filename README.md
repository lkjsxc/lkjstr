# lkjstr

`lkjstr` is a browser-first TypeScript Nostr client with an editor-style
split-pane tab workspace.

Treat [docs/README.md](docs/README.md) as the active canon for product
behavior, architecture, operations, and repository policy.

## Start Here

- Canon root: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- Workspace contract: [docs/product/workspace.md](docs/product/workspace.md)
- Timeline runtime: [docs/architecture/timeline-runtime.md](docs/architecture/timeline-runtime.md)
- Settings tab: [docs/product/settings.md](docs/product/settings.md)
- Relay management: [docs/product/relay-management.md](docs/product/relay-management.md)
- Architecture: [docs/architecture/README.md](docs/architecture/README.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)
- Repository rules: [docs/repository/README.md](docs/repository/README.md)
- Agent instructions: [AGENTS.md](AGENTS.md)

## Current Shape

- Browser-first SvelteKit and Vite web app.
- Root `/` workspace route.
- Editor-style split-pane workspace UI.
- Collapsible left sidebar for opening tabs.
- Tiles close automatically when their final tab closes.
- The workspace recovers a new tile when the final tile closes.
- Smart split behavior creates N-way layouts through normal split actions.
- Tile header actions live in a three-dot menu.
- Timeline tabs fetch and render relay events.
- Searchable settings tab with categories and inspector.
- Dark neutral low-radius theme.
- User-editable default relays.
- IndexedDB cache.
- Vitest and Playwright verification.

## Rule

When implementation and docs diverge, update docs first, then realign code.
