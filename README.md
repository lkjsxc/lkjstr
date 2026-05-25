# lkjstr

## Purpose

lkjstr is a browser-first Nostr workspace. It opens directly into a tiled
desktop-style app for reading timelines, composing notes, inspecting relay
behavior, managing signing accounts, and following event threads without a
server-side account system.

## What lkjstr Is

- A **single-page workspace** that starts on `/` with no landing page.
- A **tiled pane manager** where you open, drag, and arrange tabs side by side.
- A **browser-native Nostr client** that stores workspace, account, settings,
  drafts, notifications, and cached events locally.
- A **relay-aware tool** that lets you inspect connections, run custom requests,
  and manage your own relay list without automatic protocol overrides.

## What It Does

### Reading
- **Home** - timeline of followed pubkeys.
- **Global** - public firehose with optional filters.
- **Profile** - a user's notes and metadata.
- **Thread** - reply chains with context.
- **Notifications** - mentions, reactions, reposts, zaps.
- **Search** - cached matches plus NIP-50 relay filters when supported.

### Writing
- **Tweet** - compose and publish notes.
- **Replies, reposts, reactions** - inline event actions.
- **Zaps** - open or copy NIP-57 invoices (wallet custody is out of scope).
- **Media upload** - NIP-96 upload with NIP-98 auth.
- **Custom emoji** - NIP-30 emoji parsing and publishing.
- **Profile Edit** - update active-account metadata.

### Tools
- **Accounts** - manage local signing keys and NIP-07 browser extensions.
- **Relay Settings** - user-owned relay list with explicit import for protocol hints.
- **Custom Request** - send raw Nostr filters to selected relays.
- **Stats** - relay diagnostics and connection metrics.
- **lkjstr Log** - current-session diagnostics.
- **Mine npub** - vanity local signing key generation.
- **Welcome** - onboarding and quick-start reference.

## How to Run

Requirements: Node.js >= 24, pnpm 11.1.2.

```sh
# Install dependencies
pnpm install

# Start the dev server
pnpm dev

# Build for production
pnpm build

# Preview the production build
pnpm preview
```

## How to Verify

```sh
# Repository checks (class guard, AST rules)
pnpm check:repo

# Lint and format check
pnpm lint

# Type check
pnpm check

# Unit tests
pnpm test

# Full verification (checks + lint + type + unit tests + build)
pnpm verify

# End-to-end tests
pnpm test:e2e

# Memory-focused e2e test
pnpm test:e2e:memory

# Cloudflare Workers dry-run
pnpm cloudflare:dry-run

# Docker Compose final verification
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```

## Where Docs Live

All contracts live under [`docs/`](docs/README.md):

- **[docs/current-state.md](docs/current-state.md)** - implemented app state summary.
- **[docs/product/](docs/product/README.md)** - user-facing workspace behavior.
- **[docs/protocol/](docs/protocol/README.md)** - Nostr and relay protocol support.
- **[docs/architecture/](docs/architecture/README.md)** - runtime and data ownership.
- **[docs/operations/](docs/operations/README.md)** - verification, CI, and data safety.
- **[docs/repository/](docs/repository/README.md)** - layout, workflow, and style rules.
- **[docs/decisions/](docs/decisions/README.md)** - durable architectural decisions.
- **[docs/research/](docs/research/README.md)** - background notes and open questions.
- **[docs/vision/](docs/vision/README.md)** - long-term scope and principles.

## Repository Map

- [`.github/`](.github/) - GitHub Actions and repository automation.
- [`AGENTS.md`](AGENTS.md) - agent-facing repository rules.
- [`docs/`](docs/) - product, protocol, architecture, operations, and repository contracts.
- [`scripts/`](scripts/) - repository checks and quiet verification wrappers.
- [`src/`](src/) - SvelteKit application source.
- [`static/`](static/) - static browser assets and manifest files.
- [`tests/`](tests/) - Vitest unit tests and Playwright browser tests.
