# CI

## Purpose

CI keeps repository gates reproducible outside a developer machine.

## Gates

- `pnpm verify` runs repository checks, lint, Svelte checks, unit tests, and
  build.
- Playwright runs browser workflows with the checked-in app.
- Docker Compose validates `docker-compose.yml` and builds `app`, `verify`,
  and `e2e` targets.
- Docker Compose runs the `verify` and `e2e` targets from built images.

## Images

`main` publishes three GHCR images:

- `ghcr.io/lkjsxc/lkjstr-app`
- `ghcr.io/lkjsxc/lkjstr-verify`
- `ghcr.io/lkjsxc/lkjstr-e2e`

Images receive only the `main` tag and a `sha-<commit>` tag.

## Rules

- CI must use `docker-compose.yml`.
- Compose services must not require environment blocks.
- GHCR publishing is limited to `main`.
