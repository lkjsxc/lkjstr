# lkjstr

`lkjstr` is a TypeScript Nostr workspace client.

Treat [docs/README.md](docs/README.md) as the active canon for product
behavior, architecture, operations, and repository policy.

## Start Here

- Canon root: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- Product workspace contract: [docs/product/workspace.md](docs/product/workspace.md)
- Protocol support: [docs/protocol/nip-support.md](docs/protocol/nip-support.md)
- Architecture: [docs/architecture/README.md](docs/architecture/README.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)
- Repository rules: [docs/repository/README.md](docs/repository/README.md)
- Agent instructions: [AGENTS.md](AGENTS.md)

## Current Shape

- Browser-first SvelteKit and Vite web app.
- User-configured relay defaults.
- Editor-style split-pane workspace UI.
- Nostr protocol kernel.
- IndexedDB cache.
- Web Worker verification and indexing.
- Vitest and Playwright verification.

## Rule

When implementation and docs diverge, update docs first, then realign code.
