# lkjstr

lkjstr is a browser-first Nostr workspace. It opens directly into a tiled
desktop-style app for reading timelines, composing notes, inspecting relay
behavior, managing signing accounts, and following event threads without a
server-side account system.

## Purpose

This repository contains the lkjstr web app, its protocol/runtime
documentation, verification scripts, static assets, and tests.

## Current Contract

The implemented app state is summarized in
[docs/current-state.md](docs/current-state.md). Product behavior, protocol
support, architecture ownership, operations, and repository rules live under
[docs/](docs/README.md).

## Product Contract

- The app starts on `/` as the workspace, not a landing page.
- New Tab offers Home, Tweet, Notifications, Search, Custom Request, Global,
  Profile Edit, Accounts, Relay Settings, Stats, Settings, Upload Settings,
  lkjstr Log, Mine npub, and Welcome.
- Clean startup focuses Welcome and also creates Accounts, Relay Settings,
  Home, Notifications, and Tweet tabs.
- Browser storage owns workspace, account, settings, draft, notification, cache,
  relay, and job data with session-memory fallback.
- Selected relays remain user-owned; protocol-derived relay hints require
  explicit import before changing Relay Settings.
- Final verification uses built Docker Compose images from
  `docker-compose.yml`.

## Documentation

- [Docs index](docs/README.md)
- [Current state](docs/current-state.md)
- [Product contract](docs/product/README.md)
- [Protocol support](docs/protocol/nip-support.md)
- [Verification](docs/operations/verification.md)
- [Repository rules](docs/repository/README.md)

## Development

```sh
pnpm install
pnpm dev
pnpm check:repo
pnpm test
pnpm verify
pnpm cloudflare:dry-run
pnpm test:e2e
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```

## Repository Map

- [.github/](.github/): GitHub Actions and repository automation notes.
- [AGENTS.md](AGENTS.md): agent-facing repository rules.
- [docs/](docs/): product, protocol, architecture, operations, and repository
  contracts.
- [scripts/](scripts/): repository checks and quiet verification wrappers.
- [src/](src/): SvelteKit application source.
- [static/](static/): static browser assets and manifest files.
- [tests/](tests/): Vitest unit tests and Playwright browser tests.
