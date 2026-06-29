# CI

## Purpose

Continuous integration is intentionally cheap while long GitHub Actions are
suspended. Automatic CI/CD must not run Docker final gates, production image
publishing, Cloudflare deploys, browser workflow suites, Playwright, or
`wasm-pack test --headless` until this document is changed with matching proof.

## Automatic Job Graph

- `repository` is the only automatic pull request and `main` push job.
- It installs Node and pnpm dependencies, then runs `pnpm check:repo`.
- It does not build the production app, run Docker Compose, publish container
  images, run Wrangler deploy, or execute browser-backed tests.

## Disabled Long Actions

The following actions are deliberately absent from `.github/workflows/ci.yml`:

- Docker final gate builds and service runs.
- GHCR publish.
- Cloudflare deploy.
- Playwright or browser workflow suites.
- `wasm-pack test --headless` browser harness runs.

Do not reintroduce them to automatic CI/CD while long-action suspension is
active. If a maintainer needs release proof, run the documented local or Docker
commands outside automatic GitHub Actions and record the evidence in handoff.

## Manual Verification Commands

Docker Compose remains the authoritative final gate for local or manually
started verification:

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
- CI must stay aligned with `.github/workflows/ci.yml`: automatic CI/CD is
  repository-only until this suspension is lifted.
- Cloudflare Workers deployability is verified manually, not by automatic CI/CD,
  while this suspension is active.
