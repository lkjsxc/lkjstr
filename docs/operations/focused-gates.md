# Focused Gates

## Purpose

Focused gates map common change areas to extra checks beyond the normal quiet
and Docker verification path.

## Feed Regression

```sh
pnpm vitest run tests/unit/query/timeline-filters.test.ts
pnpm vitest run tests/unit/events/event-order.test.ts
pnpm vitest run tests/unit/timeline/timeline-reducer.test.ts
pnpm vitest run tests/unit/notifications/notification-filters.test.ts
pnpm vitest run tests/unit/timeline/timeline-follow-loading.test.ts
pnpm test:e2e -- tests/e2e/timeline-regression.spec.ts tests/e2e/timeline-multi-tab.spec.ts
```

## Relay Paging

```sh
pnpm check:repo
pnpm vitest run tests/unit/events/relay-page-segments.test.ts tests/unit/events/relay-window-policy.test.ts tests/unit/events/relay-page-density.test.ts tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-scan-hardening.test.ts tests/unit/events/relay-page-scan-cursors.test.ts tests/unit/events/relay-page-adaptive-window.test.ts
pnpm vitest run tests/unit/timeline/timeline-newer-relay-pages.test.ts tests/unit/profile/profile-store.test.ts tests/unit/profile/profile-runtime-paging.test.ts
pnpm verify:quiet
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

Adaptive relay window checks prove the initial one-minute span, sparse complete
doubling, balanced unchanged spans, limit-hit halving and retry, per-relay
density and coverage rows, cache eligibility from complete coverage,
notifications adaptive paging, Custom Request adaptive mode, display-bound
filtering, minimum-span unresolved dense frontiers, and incomplete windows that
do not grow as sparse history.

## Relay Hardening

```sh
pnpm check:repo
pnpm test -- tests/unit/protocol/bytes.test.ts tests/unit/protocol/crypto.test.ts tests/unit/protocol/event.test.ts tests/unit/protocol/nip19.test.ts
pnpm test -- tests/unit/accounts/local.test.ts tests/unit/accounts/npub-miner.test.ts
pnpm test -- tests/unit/relays/subscription-manager.test.ts tests/unit/relays/relay-client.test.ts tests/unit/relays/relay-diagnostic-log.test.ts
pnpm test -- tests/unit/relays/relay-pool-publish.test.ts tests/unit/relays/subscription-manager-dedupe.test.ts tests/unit/relays/relay-client-hardening.test.ts
pnpm test -- tests/unit/relays/relay-client-queue.test.ts tests/unit/relays/subscription-manager-read-limiter.test.ts
pnpm test -- tests/unit/timeline/timeline-runtime-close.test.ts tests/unit/timeline/timeline-runtime-route-discovery.test.ts
pnpm test -- tests/unit/events/relay-page.test.ts tests/unit/events/relay-feed-groups.test.ts tests/unit/search/search-query.test.ts tests/unit/relays/relay-info.test.ts tests/unit/relays/relay-discovery.test.ts
pnpm test -- tests/unit/workspace/tab-retention.test.ts tests/unit/settings/settings-store.test.ts tests/unit/log/app-log.test.ts
pnpm test:e2e -- tests/e2e/tab-retention.spec.ts tests/e2e/settings-tab.spec.ts tests/e2e/heavy-feed-memory.spec.ts
pnpm verify
pnpm test:e2e
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose -f docker-compose.yml run --rm verify
docker compose -f docker-compose.yml run --rm e2e
docker compose -f docker-compose.yml run --rm cloudflare
docker compose -f docker-compose.yml run --rm app-smoke
```

## Rust Relay Host

```sh
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
wasm-pack test --headless --chrome crates/lkjstr-web -- relay_socket
wasm-pack test --headless --chrome crates/lkjstr-web -- browser_timeout
wasm-pack test --headless --firefox crates/lkjstr-web -- relay_socket
wasm-pack test --headless --firefox crates/lkjstr-web -- browser_timeout
pnpm rust-wasm:quiet
```

## Memory

```sh
pnpm test -- tests/unit/relays/relay-message-data.test.ts tests/unit/protocol/messages.test.ts tests/unit/protocol/event.test.ts
pnpm test -- tests/unit/events/repository.test.ts tests/unit/events/relay-page-scan-hardening.test.ts
pnpm test -- tests/unit/notifications/notification-paging.test.ts tests/unit/notifications/notification-window.test.ts
pnpm test -- tests/unit/memory/scored-retention.test.ts tests/unit/repo-source-classes.test.ts
pnpm test -- tests/unit/custom-request/parse.test.ts tests/unit/settings/settings-store.test.ts tests/unit/events/content-tokens.test.ts
pnpm test:e2e -- tests/e2e/heavy-feed-memory.spec.ts tests/e2e/memory-churn.spec.ts --workers=1
```

Memory churn verification uses signed synthetic Nostr events and the synthetic
relay helper. App JavaScript heap is the owned assertion; Chromium RSS is
diagnostic only.

## Subscription Orchestration

```sh
pnpm vitest run tests/unit/relays/orchestration
pnpm test:e2e -- tests/e2e/subscription-lease-sharing.spec.ts tests/e2e/subscription-pane-churn.spec.ts
```

Synthetic relay acceptance:

- Active WebSocket count stays at or below enabled relay count.
- Bootstrap leases close on `EOSE`.
- Two visible matching Home tabs share one live lease.
- After closing all feed tabs, demand and lease counters return to zero.

## Startup Diagnostics

```sh
pnpm check:repo
pnpm test -- tests/unit/log/app-log.test.ts tests/unit/backend/home/home-query-registry.test.ts
pnpm test:e2e -- tests/e2e/root-workspace.spec.ts
pnpm verify:quiet
```

Acceptance: startup runtime `start()` rejections create one bounded lkjstr Log
row and no unhandled promise noise; clean Playwright root startup has no page
error, no unhandled rejection, and no app-origin SES lockdown console signal.

## Storage And Cache

```sh
pnpm check:repo
pnpm test -- tests/unit/cache/storage-quota.test.ts tests/unit/cache/compaction.test.ts tests/unit/cache/cache-status.test.ts
pnpm test -- tests/unit/settings/settings-store.test.ts tests/unit/events/repository.test.ts
```

Acceptance: default budget is `67108864`, internal byte accounting works
without browser estimates, lowering the setting enforces immediately, protected
tables survive, Stats reports the last enforcement result, and
[storage-pressure-verification.md](storage-pressure-verification.md) passes.

Storage-persistence changes test mocked `navigator.storage` support,
already-persisted, granted, denied, unsupported, and failure states without
exposing local secret material.

## Root Response

Root canonical response changes build and serve the app, then verify `/`
returns `200` without redirect and renders the implemented workspace shell. If
deployment access exists, also `curl -I` the actual configured production host;
do not invent a host.

## Relay Scoring

Relay-read scoring changes cover pure score updates, scheduling fairness,
progressive partial-page emission before slow relay EOSE, incomplete coverage
while relays are pending, cancellation ignoring late events, and synthetic relay
fast-row then late-newer-row merge.
