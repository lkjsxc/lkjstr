# Rust WASM Verification

## Purpose

This file defines verification for the Rust/WASM client target. Status:
implemented for Rust checks, the protocol bridge, storage adapters, and the
partial Leptos shell; browser-backed e2e and wasm-pack browser harness tests are
temporarily suspended.

## Local Matrix

Run the Rust/WASM local gate through `lkjstr-xtask`:

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
trunk build --release
```

## Temporary Browser Test Suspension

`wasm-pack test --headless --chrome crates/lkjstr-web` and
`wasm-pack test --headless --firefox crates/lkjstr-web` are not required local,
Docker, or CI/CD gates while the suspension is active. Do not wire Playwright,
browser workflow suites, or wasm-pack browser tests into CI/CD. Manual runs,
including `LKJSTR_RUN_E2E=1 pnpm rust-wasm:quiet`, are allowed only as
diagnostics and must be reported as manual, not as canonical verification.

The quiet gate unsets `NO_COLOR` for Trunk because Trunk `0.21.14` rejects
`NO_COLOR=1`.

## Docker Matrix

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
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

`pnpm check:repo` remains active while TypeScript, Svelte, focused tests,
Wrangler, or repository scripts are still part of product verification.
