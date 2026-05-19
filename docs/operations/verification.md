# Verification

## Purpose

Verification commands prove docs, source, unit behavior, build, and browser
flows.

## Local

```sh
pnpm check:repo
pnpm kit:sync
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm test:e2e
pnpm verify:quiet
pnpm test:e2e:quiet
```

## Docker

```sh
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
```

## Gate

Use `pnpm verify` for normal local verification. Use Docker after Compose or
Dockerfile changes and before claiming image-backed verification. CI must run
the same local, browser, and Docker-backed gates.

Quiet commands are preferred in agent runs. They print a short success line
when commands pass and print buffered command output only when a command fails.

## Memory

The heavy-feed browser smoke test reports app JavaScript heap, runtime item
counters, and total Chromium RSS. The app heap gate is `100 MB`; RSS is
diagnostic because browser baseline memory is outside app control.
