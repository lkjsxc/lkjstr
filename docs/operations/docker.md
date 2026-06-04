# Docker

## Purpose

Docker Compose is the final verification wrapper. Services build images and do
not mount the source tree.

## Services

- `app` builds the production app and runs Vite preview on port `5173`.
- `verify` runs `cargo run -p lkjstr-xtask -- quiet verify` in the image.
- `cloudflare` runs the Cloudflare dry-run through the quiet wrapper.
- `app-smoke` starts from the app image and fetches `/` through the production
  preview smoke script.

## Commands

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

## Guardrails

- Compose files do not define `develop`, `watch`, bind mounts, or service
  environment overrides.
- The app image owns the production build output used by smoke checks.
- Cloudflare deployability remains separate from the app smoke service so
  Wrangler and adapter failures stay visible.
