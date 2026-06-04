# CI

## Purpose

Continuous integration runs the same quiet and Docker-backed gates expected of
LLM agents.

## Jobs

- `verify` installs Node dependencies and runs `pnpm verify:quiet`.
- `compose` validates Compose config, builds `app`, `verify`, `cloudflare`, and
  `app-smoke`, then runs the `verify`, `cloudflare`, and `app-smoke` services.
- `publish` builds and publishes the `app` target to GHCR from `main` after the
  verification jobs pass.

## Compose Commands

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

## Rules

- Passing quiet commands emit one final `ok ...` line.
- Failure output is bounded and local to the failed step.
- Cloudflare Workers Static Assets deployability stays green.
- CI does not run browser workspace workflow suites.
