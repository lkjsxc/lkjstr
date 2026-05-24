# Docker

## Purpose

Docker docs define the Compose verification path.

## Contract

- Compose services build images from `Dockerfile`.
- Services do not mount the source tree.
- Services do not require Compose environment blocks.
- `app` builds the app and runs `pnpm preview` from the built image.
- `verify` runs `pnpm verify` from the built image.
- `e2e` installs Playwright browser dependencies in its image.
- `e2e` builds the app and runs Playwright against production preview.
- `cloudflare` runs the Wrangler dry-run verification from the built image.
- Docker verification must run after feed-memory changes because browser heap
  behavior depends on the built app bundle.
- Docker verification must also run after account, workspace, protocol, or
  settings contract changes when Docker is available.

## Commands

```sh
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
```
