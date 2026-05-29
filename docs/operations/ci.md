# CI

## Purpose

CI keeps repository gates reproducible outside a developer machine.

## Gates

- `pnpm verify` runs repository checks, lint, Svelte checks, unit tests, and
  build.
- Playwright runs browser workflows with the checked-in app.
- Docker Compose validates `docker-compose.yml` and builds `app`, `verify`,
  `e2e`, `cloudflare`, and `app-smoke` targets.
- Docker Compose runs the `verify`, `e2e`, `cloudflare`, and `app-smoke`
  targets from built images.
- Docker Compose runs `app-smoke`, which starts production preview on port
  `5173`, fetches `/`, and fails on non-OK or blank app HTML.

## Images

`main` publishes one GHCR image:

- `ghcr.io/lkjsxc/lkjstr`

The image builds from the `app` Dockerfile target and receives `latest` and
`sha-<commit>` tags, so `ghcr.io/lkjsxc/lkjstr:latest` is the default runtime
image.

## Rules

- CI must use `docker-compose.yml`.
- Compose services must not require environment blocks.
- The Compose gate includes `cloudflare` and `app-smoke`.
- GHCR publishing is limited to `main`.
