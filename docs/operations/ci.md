# CI

## Purpose

Continuous integration runs a deduplicated graph with Docker Compose as the
authoritative final gate.

## Job Graph

- `repository` is cheap host feedback. It runs `pnpm check:repo` and does not
  build the production app.
- `docker-final` validates Compose config, builds `app`, `verify`,
  `cloudflare`, and `app-smoke`, then runs `verify`, `cloudflare`, and
  `app-smoke` services from those images. The `verify` image runs
  `lkjstr-xtask quiet docker-verify`, so the production app build is owned by
  the `app` image.
- `publish` runs only from `main` after `docker-final` passes. It reuses the
  checked app image or the same Docker cache and target, and does not run an
  unrelated cold rebuild.
- `deploy-cloudflare` runs only from `main` when repository variable
  `CLOUDFLARE_DEPLOY_ENABLED` is `true`. It depends on `docker-final`, installs
  Node 24, pnpm 11.1.2, Rust stable, the wasm32 target, and `wasm-pack 0.15.0`,
  then runs `pnpm build`, `pnpm cloudflare:dry-run:built`, and Wrangler deploy.

## Compose Commands

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

## No Duplicate Work

- CI must not run full host verification and then repeat the same full
  verification inside Docker on the default pull request path.
- CI must not build the production app repeatedly unless a target needs a
  distinct artifact.
- Cloudflare dry-run consumes the already-built app artifact inside Docker and
  verifies bridge assets before Wrangler dry-run.
- Publish should reuse the checked app image or the same build cache and target.
- `xtask` quiet orchestration must not recurse through `pnpm` commands that call
  `xtask` again.

## Rules

- Passing quiet commands emit one final `ok ...` line.
- Failure output is bounded and local to the failed step.
- Cloudflare Workers Static Assets deployability stays green.
- CI does not run browser workspace workflow suites.
