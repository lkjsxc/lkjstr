# Relay Focused Gates

## Purpose

This file owns focused gates for relay paging, relay hardening, subscription orchestration, and Rust relay host changes.

## Gates

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
