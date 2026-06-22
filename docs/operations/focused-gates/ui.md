# UI Focused Gates

## Purpose

This file owns focused gates for root response and user-visible workspace smoke checks.

## Gates

## Root Response

```sh
pnpm build
pnpm exec tsx scripts/app-smoke.ts
pnpm cloudflare:quiet
```

Acceptance: `/` returns `200` without redirect and renders the implemented
workspace shell. If deployment access exists, also check the configured
production host; do not invent a host.

## Docker Final Gate

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```
