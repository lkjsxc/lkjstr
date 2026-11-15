# Verification

## Purpose

Gates for the sole TypeScript frontend and Rust/WASM Worker product.

## Quiet gates

Each root gate prints one ok line on success and a bounded tail on failure.

| Command | Runs |
| --- | --- |
| pnpm check:repo | doc topology, line caps and Rust style rules |
| pnpm test:quiet | fmt, native/WASM clippy, cargo test --workspace |
| pnpm rust-wasm:quiet | Rust gates, real frontend/Worker build, dist check |
| pnpm verify:quiet | repo checks plus the rust-wasm gate |
| sh scripts/engine-check.sh | loopback Worker conformance and delayed profile probe |

No Trunk installation or second interface is involved. The root Cargo.toml is
a virtual workspace; crates/lkjstr-engine-worker builds the browser engine.
Use CARGO_BUILD_JOBS=4 and RUST_TEST_THREADS=4 on shared hosts. Put caches in
ignored tmp/: CARGO_HOME, XDG_CACHE_HOME, XDG_CONFIG_HOME, XDG_DATA_HOME and
TMPDIR. Set LKJSTR_WASM_BINDGEN to the matching wasm-bindgen-cli if needed.

## Frontend and real browser gates

In web/, run pnpm check, pnpm build and pnpm smoke for the mock test double.
Then run pnpm build:real and pnpm smoke:real for the shipped engine graph.
The real check covers Global/Home, note/profile/thread navigation, search,
compose/sign/publish, reactions, relay settings across reload and two tabs.
All browser servers bind fresh loopback ports and use fresh local data.
HTTP is intercepted, relays are loopback fixtures, and no checks publish to
public relays. browser-relay.mjs remains a shared bounded fixture helper.
The Leptos-only browser drivers and their CSS/string guards have been removed.

The Worker harness validates replies against this worktree's protocol.ts and
drives every mock message kind, action name and query source. It includes
cache restart, signer validation, uploads, visibility release, shared clients,
leader loss and a simulated idle clock. The optional cold-start benchmark is
separate. Reports live under tmp/engine-harness/ and tmp/smoke-real/.

## Manual public sample

scripts/engine-public-sample.mjs is deliberately absent from automated gates.
It only sends REQ/CLOSE, saves public events locally, and never loads an account
or publishes. The one 200-note sample, signature verification, ten held excerpts
and policy limitations are recorded in engine-polish.md. Offline reanalysis:

```sh
cargo run -q -p lkjstr-core --example engine-global-sample \
  < tmp/public-sample/events.json > tmp/public-sample/report.json
```

## Docker

Docker Compose verify remains the final gate where Docker is available:

```sh
docker compose --progress quiet -f docker-compose.yml build verify
docker compose --progress quiet -f docker-compose.yml run --rm verify
```

The Dockerfile builds the same real frontend and Worker with Node/pnpm and
wasm-bindgen-cli. Docker is unavailable in this session and was not attempted.
No services, deployments, production systems or CI workflows were changed.

## Current record

Engine polish adds native tests for profile routing/batching/context, count
states and Global filtering, plus the delayed loopback profile check and a
mock count regression. Results and handoff decisions are in engine-polish.md.
Historical integration measurements remain in integration-release.md and
engine-performance.md; old Leptos browser results do not verify this product.

All four root quiet gates pass after the final changes. web/ check, mock build
and smoke pass; the real build and all 13 real-app browser checks pass.
engine-check.sh passes 54 conformance checks plus the delayed profile probe
(1893.7 ms before, 232.5 ms after, with 240 ms loopback delay). Docker is the
only requested environment gate not run. Reports stay in ignored tmp/.
