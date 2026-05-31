# Rust WASM Verification

## Purpose

This file defines verification for the Rust/WASM client target. Status:
implemented for Rust checks and the protocol WASM bridge; design-only for
Trunk, Docker Rust/WASM, and full product e2e gates.

## Local Matrix

```sh
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
wasm-pack test --headless --firefox crates/lkjstr-web
wasm-pack test --headless --chrome crates/lkjstr-web
trunk build --release
pnpm test:e2e:quiet
pnpm cloudflare:quiet
```

## Docker Matrix

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify e2e cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm e2e
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

## Repository Checks

`lkjstr-xtask` owns Rust-aware checks:

- docs topology.
- docs line cap.
- source line cap including Rust files.
- forbidden production panic paths.
- storage manifest doc comparison.
- quiet command orchestration.

`pnpm check:repo` remains active until `lkjstr-xtask` provides the same checks
and the Node tooling is no longer required for product runtime verification.
