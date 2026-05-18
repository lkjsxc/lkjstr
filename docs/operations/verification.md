# Verification

## Purpose

Verification commands prove docs, source, unit behavior, build, and browser
flows.

## Local

```sh
pnpm check:repo
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm test:e2e
```

## Docker

```sh
docker compose config
docker compose build app verify e2e
docker compose run --rm verify
docker compose run --rm e2e
```

## Gate

Use `pnpm verify` for normal local verification. Use Docker after Compose or
Dockerfile changes and before claiming image-backed verification.
