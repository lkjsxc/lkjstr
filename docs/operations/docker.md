# Docker

## Purpose

Docker docs define the Compose verification path.

## Contract

- Compose services build images from `Dockerfile`.
- Services do not mount the source tree.
- Services do not require Compose environment blocks.
- `app` builds the implemented app and serves the built static output.
- `verify` runs repository verification from the built image.
- `e2e` installs Playwright browser dependencies in its image.
- `e2e` builds the app and runs Playwright against production preview.
- `cloudflare` runs the Wrangler dry-run verification from the built image.
- `app-smoke` starts production preview on port `5173`, fetches `/`, and fails
  on non-OK or blank app HTML.
- Docker Compose is the final verification gate for agent changes. Run config,
  build `app`, `verify`, `e2e`, `cloudflare`, and `app-smoke`, then run the
  `verify`, `e2e`, `cloudflare`, and `app-smoke` services from those images.
- The Rust/WASM target keeps the same service names while replacing product
  build internals with cargo, WASM, Trunk, and repository-check gates.

## Commands

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```
