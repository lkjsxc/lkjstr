# lkjstr

## Purpose

lkjstr is a browser-first Nostr workspace built with SvelteKit. The app opens
directly into split tiles, stores local state in IndexedDB, and uses the
selected default relay set for timeline, profile, thread, and Tweet behavior.

## Docs

- Canon: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- CI and images: [docs/operations/ci.md](docs/operations/ci.md)
- Product tabs: [docs/product/workspace/tabs.md](docs/product/workspace/tabs.md)
- Runtime contracts:
  [docs/architecture/workspace/tab-runtime.md](docs/architecture/workspace/tab-runtime.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)

## Contract

- New Tab choices are Home, Global, Relay Settings, Relay Logs, Notifications,
  Accounts, Tweet, Settings, and Cache.
- Profile tabs open from identity actions. Thread tabs open from event actions.
- Tabs can be reordered inside a tile and moved to another tile by native
  drag-and-drop.
- Moving the last tab out of a tile closes the source tile.
- Settings are one flat key-value list.
- Home, Global, Notifications, Profile, and Thread reads use enabled read relays
  in the selected default set. Disabled or removed relays are not silent
  fallbacks.
- Partial relay failure is diagnostic; reachable relays continue serving feeds,
  and low-level details are visible in Relay Logs instead of timeline bodies.
- Event metadata shows the author control and date. Full
  public keys and relay URLs stay out of post rows.
- Accounts include CPU-only `npub` prefix mining with export-only `nsec`
  handling.
- Tweet drafts are durable and publish through NIP-07 to enabled write relays.
- Tile resize uses a `1.8` pointer sensitivity multiplier.
- Startup renders the Home workspace immediately. Browser storage failures
  degrade to session memory and must not leave an empty page.
- Docker verification uses `docker-compose.yml` built images with no bind
  mounts or required environment blocks.

## Commands

```sh
pnpm install
pnpm dev
pnpm verify
pnpm verify:quiet
pnpm test:e2e:quiet
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
```
