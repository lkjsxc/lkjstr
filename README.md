# lkjstr

`lkjstr` is a browser-first TypeScript Nostr client with an editor-style
split-pane tab workspace.

Treat [docs/README.md](docs/README.md) as the active canon for product
behavior, architecture, operations, and repository policy.

## Start Here

- Canon root: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- Workspace contract: [docs/product/workspace.md](docs/product/workspace.md)
- Settings tab: [docs/product/settings.md](docs/product/settings.md)
- Relay management: [docs/product/relay-management.md](docs/product/relay-management.md)
- Protocol support: [docs/protocol/nip-support.md](docs/protocol/nip-support.md)
- Architecture: [docs/architecture/README.md](docs/architecture/README.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)
- Repository rules: [docs/repository/README.md](docs/repository/README.md)
- Agent instructions: [AGENTS.md](AGENTS.md)

## Current Shape

- Browser-first SvelteKit and Vite web app.
- Root `/` workspace route.
- Editor-style split-pane workspace UI.
- Empty workspace and empty pane states.
- Two-way and N-way horizontal or vertical pane splits.
- Searchable key-value settings tab.
- Dark neutral low-radius theme.
- Seeded user-editable default relays.
- Nostr protocol kernel.
- IndexedDB cache.
- Web Worker verification and indexing.
- Vitest and Playwright verification.

## Rule

When implementation and docs diverge, update docs first, then realign code.
