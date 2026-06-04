# Verification

## Purpose

Verification proves documentation rules, source shape, focused behavior tests,
Rust/WASM checks, production build output, Cloudflare deployability, and the
production root response. Browser workflow suites are not canonical gates.

## Quiet Verification Contract

Quiet commands are canonical for LLM-agent and CI runs.

A passing quiet command prints only one final success line:

- `ok test`
- `ok verify`
- `ok ci`
- `ok cloudflare`
- `ok rust-wasm`

Quiet commands capture child stdout and stderr in memory. They print captured
output only when the child exits with a nonzero status, is terminated by a
signal, or fails to spawn.

Quiet commands must not hide diagnostics. On failure they print the step name,
exit status or signal, and the captured output tail with a bounded byte budget.

Normal verbose commands remain available for local debugging:

- `pnpm test`
- `pnpm verify`
- `pnpm cloudflare:dry-run`

CI must use quiet commands by default. Host-boundary Rust/WASM tests may use
headless browsers when Node cannot represent the platform API, but they do not
exercise tiled workspace browser flows.

## Local Canonical Gate

Run documentation and repository checks before implementation continues after a
contract change:

```sh
pnpm check:repo
```

Run focused and quiet local gates:

```sh
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
pnpm cloudflare:quiet
```

`pnpm verify:quiet` runs repository checks, lint, typecheck, unit tests, and a
production build. `pnpm ci:quiet` runs the same quiet local plan. Cloudflare
stays separate so adapter and Wrangler failures remain easy to isolate.

## Rust And Host Boundary

```sh
cargo run -p lkjstr-xtask -- quiet rust-wasm
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo test --workspace
wasm-pack test --headless --chrome crates/lkjstr-web
wasm-pack test --headless --firefox crates/lkjstr-web
trunk build --release
pnpm rust-wasm:quiet
```

Browser-backed Rust/WASM checks are limited to worker, timeout, WebSocket,
WASM boundary, and storage-host behavior that Node cannot represent.

## SQLite OPFS Focused Gate

```sh
cargo test -p lkjstr-storage
wasm-pack test --headless --chrome crates/lkjstr-web -- storage
wasm-pack test --headless --firefox crates/lkjstr-web -- storage
pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
```

SQLite verification proves worker ownership, temporary-memory fallback,
repository result shapes, retention deletion, inventory summaries, and Stats
projection. It does not open a full browser workspace flow.

## Docker

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

Focused change-area gates live in [focused-gates.md](focused-gates.md). Run the
matching focused gate before the final Docker gate when a change touches that
area.

## Acceptance Checks

Automated checks own these assertions through unit, integration, Rust/WASM,
Cloudflare, and app-smoke layers:

- Repository docs, README coverage, line limits, storage manifest docs,
  functional style checks, runtime counter keys, timers, and storage boundaries
  pass.
- Unit and integration tests cover workspace reducers, tab snapshots, settings,
  relay orchestration, feed merge/window reducers, storage repositories,
  retention, inventory, Stats projection, and background cleanup.
- Rust tests cover protocol kernels, feed LOD reducers, retention scoring,
  relay scoring, route-evidence trust, scan density, and storage row codecs
  whenever those pure reducers exist.
- Cloudflare dry-run builds Workers Static Assets with the `ASSETS` binding and
  no app backend, relay proxy, or account service.
- App-smoke builds the production app, serves preview, fetches `/`, and verifies
  a nonblank workspace shell response.

Manual diagnostics own these observations when a human or agent needs browser
runtime evidence:

- Root route remains visible when local storage, IndexedDB, or OPFS are denied.
- Static hosting serves SQLite worker and WASM assets with required isolation
  headers while that runtime remains active.
- Long browser sessions keep UI responsive under relay churn and storage
  pressure.
- Browser heap snapshots and Chromium RSS help investigate memory pressure;
  RSS is diagnostic only.
- Real production hosts return expected headers when deployment access exists.

## Storage Pressure Acceptance

- Stats reads SQLite storage health and mode instead of showing indefinite
  loading.
- Compact keeps protected SQLite rows and reports quota or stop reasons when it
  cannot reach the target.
- If browser usage remains over target, the stop reason is exact:
  `no-prunable-candidates`, `protected-only`, `unknown-unowned-usage`,
  `inventory-incomplete`, `quota-pressure`, `storage-api-unavailable`, or
  `compaction-error`.
- Inventory separates SQLite table estimates, ledger bytes, localStorage, Cache
  Storage, old IndexedDB presence, unknown storage, and residual browser
  overhead without scanning every old row.

## Feed And Relay Acceptance

- Home, Global, Notifications, Thread, and Profile rows preserve real ordering,
  relay provenance, avatar/name fallbacks, timestamps, wrapped content, and
  unavailable reference states backed by real events or compact missing states.
- Cached Home rows render before relay responses and before profile hydration
  when coverage is complete.
- Identity, Profile, Thread, quote, reference, media, notification, and Tweet
  actions are covered by reducer, repository, and component contract tests at
  the smallest useful layer.
- Inactive feed tabs release live relay work and restore from DOM, snapshots, or
  SQLite when reselected.
- Queued relay page reads abort when the owning runtime or subscription manager
  closes and do not remain in limiter queues.
- Relay optimizer Stats rows are real, deduped by stable keys, and resolve to
  available, unavailable, timeout, or memory-fallback states.
