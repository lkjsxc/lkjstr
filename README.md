# lkjstr

lkjstr is a browser-first Nostr workspace. It opens directly into a tiled
desktop-style app for reading timelines, composing notes, inspecting relay
behavior, managing signing accounts, and following event threads without a
server-side account system.

## Purpose

This repository contains the lkjstr web app, its protocol/runtime
documentation, verification scripts, static assets, and tests.

## What It Does

- Reads Home, Global, Profile, Thread, and Notifications from the selected
  default relay set.
- Opens Author Context tabs for nearby posts by one author and Custom Request
  tabs for validated one-shot relay filters.
- Publishes Tweet notes, replies, reposts, reactions, and zaps with the active
  signing account.
- Keeps workspace layout, tabs, accounts, settings, drafts, notifications, and
  cache state in browser storage with session-memory fallback.
- Builds for Cloudflare Workers Static Assets as a hosting target without
  adding a required backend account system, relay proxy, or Cloudflare storage
  dependency.
- Renders Nostr entities, media, custom emoji, event references, content
  warnings, nested reposts, and notification event bodies from real events.
- Provides lkjstr Log and Stats tabs for relay, subscription, publish, cache,
  storage, runtime, and job diagnostics.

## Product Contract

- The app starts on `/` as the workspace, not a landing page.
- New Tab offers Home, Tweet, Notifications, Search, Custom Request, Global,
  Profile Edit, Accounts, Relay Settings, Stats, Settings, Upload Settings,
  lkjstr Log, Mine npub, and Welcome.
- Home uses the active account and its latest NIP-02 follow list. Global does
  not require an account. Profile and Thread tabs are opened from identity and
  event actions.
- Event menus can copy event IDs and open Author Context tabs with nearby real
  authored events.
- Tweet publish signs the event, stores it locally, starts relay publishing,
  clears and focuses the composer immediately, and only reports late all-relay
  rejection or publish errors.
- Incoming NIP-30 custom emoji shortcodes may contain letters, numbers,
  underscores, and hyphens. lkjstr-created local shortcode fields stay stricter
  and emit only letters, numbers, and underscores.
- Sensitive posts stay revealed for the current app session after the user
  reveals them.
- Docker verification uses built images from `docker-compose.yml`; it does not
  depend on bind mounts or required environment variables.

## Documentation

- [Current state](docs/current-state.md)
- [Product workspace tabs](docs/product/workspace/tabs.md)
- [Tweet tool](docs/product/tools/tweet.md)
- [Event actions](docs/product/tools/event-actions.md)
- [Custom emoji](docs/protocol/custom-emoji.md)
- [Protocol support](docs/protocol/nip-support.md)
- [Verification](docs/operations/verification.md)
- [Cloudflare Workers](docs/operations/cloudflare-workers.md)

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
