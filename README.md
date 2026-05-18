# lkjstr

lkjstr is a browser-first Nostr workspace built with SvelteKit. The app opens
directly into split tiles, stores local state in IndexedDB, and uses the
selected default relay set for timeline, profile, thread, and Tweet behavior.

## Docs

- Canon: [docs/README.md](docs/README.md)
- Current state: [docs/current-state.md](docs/current-state.md)
- Product tabs: [docs/product/tabs.md](docs/product/tabs.md)
- Runtime contracts: [docs/architecture/tab-runtime.md](docs/architecture/tab-runtime.md)
- Verification: [docs/operations/verification.md](docs/operations/verification.md)

## Contract

- New Tab choices are Timeline, Relay Settings, Relay Monitor, Notifications,
  Accounts, Tweet, Settings, and Cache.
- Profile tabs open from identity actions. Thread tabs open from event actions.
- Settings are one flat key-value list.
- Timeline, profile, and thread reads use enabled read relays in the selected
  default set. Disabled or removed relays are not silent fallbacks.
- Tweet drafts are durable and publish through NIP-07 to enabled write relays.
- Tile resize uses a `0.9` pointer sensitivity multiplier.
- Docker verification uses built images with no bind mounts.

## Commands

```sh
pnpm install
pnpm dev
pnpm verify
docker compose config
docker compose build app verify e2e
docker compose run --rm verify
docker compose run --rm e2e
```
