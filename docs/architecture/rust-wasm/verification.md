# Rust WASM Verification

## Purpose

This file defines verification for the Rust/WASM client target. Status:
implemented for Rust checks, browser WASM tests, the protocol bridge, storage
adapters, and the partial Leptos shell; partial for Trunk and Docker gates.

## Local Matrix

Run the full Rust/WASM local gate through `lkjstr-xtask`:

```sh
cargo run -p lkjstr-xtask -- quiet rust-wasm
pnpm rust-wasm:quiet
```

Both commands run the same matrix and print `ok rust-wasm` on success. The
package script is a discoverable wrapper for agents already using pnpm quiet
commands.

The matrix runs:

```sh
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo test --workspace
wasm-pack test --headless --chrome crates/lkjstr-web
wasm-pack test --headless --firefox crates/lkjstr-web
trunk build --release
```

The quiet gate unsets `NO_COLOR` for Trunk because Trunk `0.21.14` rejects
`NO_COLOR=1`.

`crates/lkjstr-web/webdriver.json` owns browser capabilities for wasm-pack
tests. Chrome uses container-safe flags for Docker.

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

`pnpm check:repo` remains active while TypeScript, Svelte, Playwright, Wrangler,
or repository scripts are still part of product verification.
