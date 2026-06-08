# Focused Gates

## Purpose

Focused gates map common change areas to small checks beyond the normal quiet
and Docker verification path.

## Feed Regression

```sh
pnpm test -- tests/unit/query/timeline-filters.test.ts
pnpm test -- tests/unit/events/event-order.test.ts tests/unit/events/feed-window.test.ts
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts
pnpm test -- tests/unit/notifications/notification-filters.test.ts
pnpm test -- tests/unit/timeline/timeline-follow-loading.test.ts
pnpm test -- tests/unit/events/event-tree-list-anchors.test.ts
cargo test -p lkjstr-app feed_window
```

Acceptance: rows stay newest-first, duplicate events merge by id, footer states
match real coverage, top-locked live inserts stay at scroll offset `0`, and
missing coverage never proves absence.

## User-Requested Reliability

```sh
pnpm test -- tests/unit/workspace/new-tab-options.test.ts tests/unit/workspace/action-tabs.test.ts
pnpm test -- tests/unit/profile/profile-follow-count.test.ts tests/unit/profile/profile-runtime-paging.test.ts
pnpm test -- tests/unit/user-timeline tests/unit/follow-graph
pnpm test -- tests/unit/search/search-query.test.ts
pnpm test -- tests/unit/tweet/tweet-composer-layout.test.ts
cargo test -p lkjstr-protocol nip19
cargo test -p lkjstr-domain new_tab_catalog
cargo test -p lkjstr-app follow_graph cache_display hydration_priority
```

Acceptance: lkjsxc opens a fixed User Timeline, unknown following counts are not
zero, profile empty states wait for proof, User Timeline chunks large author
sets, local Search uses the index, and Tweet Publish layout stays fixed.

## Relay Paging

```sh
pnpm check:repo
pnpm test -- tests/unit/events/relay-page-segments.test.ts tests/unit/events/relay-window-policy.test.ts
pnpm test -- tests/unit/events/relay-page-density.test.ts tests/unit/events/relay-page-scan.test.ts
pnpm test -- tests/unit/events/relay-page-scan-hardening.test.ts tests/unit/events/relay-page-scan-cursors.test.ts
pnpm test -- tests/unit/events/relay-page-adaptive-window.test.ts
pnpm test -- tests/unit/profile/profile-store.test.ts tests/unit/profile/profile-runtime-paging.test.ts
pnpm verify:quiet
```

Acceptance: adaptive windows, per-relay density, cache eligibility, display
bounds, and incomplete windows are proven with deterministic unit tests.

## Relay Hardening

```sh
pnpm check:repo
pnpm test -- tests/unit/protocol/bytes.test.ts tests/unit/protocol/crypto.test.ts tests/unit/protocol/event.test.ts
pnpm test -- tests/unit/protocol/nip19.test.ts tests/unit/accounts/local.test.ts tests/unit/accounts/npub-miner.test.ts
pnpm test -- tests/unit/relays/subscription-manager.test.ts tests/unit/relays/relay-client.test.ts
pnpm test -- tests/unit/relays/relay-diagnostic-log.test.ts tests/unit/relays/relay-pool-publish.test.ts
pnpm test -- tests/unit/relays/subscription-manager-dedupe.test.ts tests/unit/relays/relay-client-hardening.test.ts
pnpm test -- tests/unit/relays/relay-client-queue.test.ts tests/unit/relays/subscription-manager-read-limiter.test.ts
pnpm test -- tests/unit/events/relay-page.test.ts tests/unit/events/relay-feed-groups.test.ts tests/unit/search/search-query.test.ts
pnpm test -- tests/unit/workspace/tab-retention.test.ts tests/unit/settings/settings-store.test.ts tests/unit/log/app-log.test.ts
pnpm verify:quiet
```

Acceptance: partial relay failure stays diagnostic, disabled relays stay
excluded, late events after cancellation are ignored, and limiter queues drain.

## Subscription Orchestration

```sh
pnpm test -- tests/unit/relays/orchestration
pnpm test -- tests/unit/relays/subscription-manager-dedupe.test.ts
pnpm test -- tests/unit/relays/subscription-manager-read-limiter.test.ts
```

Acceptance:

- Active WebSocket count stays at or below enabled relay count.
- Bootstrap leases close on `EOSE`.
- Matching visible Home tabs share one live lease.
- Hidden or closed feed tabs release live demands and leases.

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
pnpm test -- tests/unit/relays/relay-message-data.test.ts tests/unit/protocol/messages.test.ts
pnpm test -- tests/unit/events/repository.test.ts tests/unit/events/relay-page-scan-hardening.test.ts
pnpm test -- tests/unit/notifications/notification-paging.test.ts tests/unit/notifications/notification-window.test.ts
pnpm test -- tests/unit/memory tests/unit/fp tests/unit/app/runtime-counters.test.ts
pnpm test -- tests/unit/custom-request/parse.test.ts tests/unit/settings/settings-store.test.ts
```

Acceptance: app-owned counters, cleanup paths, wait queues, and bounded maps
return to documented idle states. Browser RSS is diagnostic only.

## Storage And Cache

```sh
pnpm check:repo
pnpm test -- tests/unit/cache/storage-quota.test.ts tests/unit/cache/compaction.test.ts
pnpm test -- tests/unit/cache/cache-status.test.ts tests/unit/cache/cache-ledger.test.ts
pnpm test -- tests/unit/storage tests/unit/events/repository.test.ts tests/unit/settings/settings-store.test.ts
```

Acceptance: default budget is `67108864`, byte accounting works without browser
estimates, lowering the setting enforces immediately, protected tables survive,
Stats reports the last enforcement result, and
[storage-pressure-verification.md](storage-pressure-verification.md) passes.

## Background Work

```sh
pnpm test -- tests/unit/fp/resource-scope.test.ts tests/unit/fp/async.test.ts
pnpm test -- tests/unit/memory tests/unit/cache tests/unit/relays/orchestration
```

Acceptance: every task has an owner, cancellation is idempotent, queue bounds
are enforced, maintenance work yields, and late completions do not retain owners.

## Root Response

```sh
pnpm build
pnpm exec tsx scripts/app-smoke.ts
pnpm cloudflare:quiet
```

Acceptance: `/` returns `200` without redirect and renders the implemented
workspace shell. If deployment access exists, also check the configured
production host; do not invent a host.

## Rust First Cutover Task Gates

Use this table when a task id appears in the Rust/WASM cutover plan. Run the
listed focused gate before the repository and Docker gates.

| Task    | Focused gate                                                                             |
| ------- | ---------------------------------------------------------------------------------------- |
| D-001   | `cargo run -p lkjstr-xtask -- check-docs` and `cargo run -p lkjstr-xtask -- check-lines` |
| D-002   | Docs checks plus `pnpm check:repo`                                                       |
| D-003   | Docs checks plus local Markdown link checks through `pnpm check:repo`                    |
| S-001   | `cargo test -p lkjstr-storage` and `cargo test -p lkjstr-web storage`                    |
| S-002   | `cargo test -p lkjstr-storage event_cache` and storage repository tests                  |
| S-003   | `cargo test -p lkjstr-storage feed_cache` and `cargo test -p lkjstr-app cache_display`   |
| S-004   | Storage And Cache plus `cargo test -p lkjstr-storage retention` when the module exists   |
| R-001   | Rust Relay Host and `cargo test -p lkjstr-relays client ingress`                         |
| R-002   | Relay Paging plus `cargo test -p lkjstr-relays page_read request_budget`                 |
| R-003   | Subscription Orchestration plus progressive read reducer tests                           |
| F-001   | Feed Regression plus `cargo test -p lkjstr-app feed`                                     |
| F-002   | Feed Regression plus UI component or browser tests for the changed Leptos feed rows      |
| F-003   | Feed Regression and Subscription Orchestration Home checks                               |
| F-004   | Relay Paging plus selected-relay Global checks                                           |
| F-005   | Profile focused tests and shared feed runtime tests                                      |
| F-006   | Thread exact-read tests and shared event-display tests                                   |
| F-007   | Notification filters, paging, window, and reference hydration tests                      |
| Q-001   | Search query tests plus Rust app or storage search tests                                 |
| Q-002   | Custom Request parse/read tests plus relay routing tests                                 |
| P-001   | Publish job Rust tests plus relay publish tests                                          |
| P-002   | Tweet draft, signer, upload, and publish queue tests                                     |
| P-003   | Profile Edit publish tests plus event cache update tests                                 |
| P-004   | Public Chat reducer, NIP-28 routing, publish, and cleanup tests                          |
| SEC-001 | Local secret, WebAuthn/Web Crypto host-boundary, migration, and redaction tests          |
| SEC-002 | Diagnostics redaction grep tests, unit redaction tests, and UI log tests                 |
| NIP-001 | Client-tag protocol tests and every changed write-surface publish test                   |
| NIP-002 | NIP-29 protocol, route, storage, relay, and UI tests                                     |
| DM-001  | NIP-17, NIP-44, NIP-59 envelope, relay, storage, and unavailable-state tests             |
| UX-001  | Workspace startup, split, resize, drag, snapshot, and fallback tests                     |
| UX-002  | Focused test for each changed tool plus Stats diagnostics tests                          |
| CUT-001 | `pnpm check:repo`, no-import `rg`, and `cargo run -p lkjstr-xtask -- check-lines`        |
| CUT-002 | Root Response, `pnpm cloudflare:quiet`, Docker app-smoke                                 |

## Docker Final Gate

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```
