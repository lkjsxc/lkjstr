# Rust WASM Verification

## Purpose

Rust and host-boundary verification commands.

## Temporary Browser Test Suspension

Automated browser-backed e2e and wasm-pack browser harness tests are currently
not part of local quiet gates, Docker verification, or CI/CD. Do not run these
commands as required gates while the suspension is active:

```sh
wasm-pack test --headless --chrome crates/lkjstr-web
wasm-pack test --headless --firefox crates/lkjstr-web
```

They may be run manually only for investigation, either directly or with
`LKJSTR_RUN_E2E=1 pnpm rust-wasm:quiet`, and the handoff must record them as
manual diagnostics rather than required verification.

## Details

```sh
cargo run -p lkjstr-xtask -- quiet rust-wasm
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo clippy -p lkjstr-web --target wasm32-unknown-unknown --all-targets -- -D warnings
cargo test --workspace
trunk build --release
pnpm rust-wasm:quiet
```

Browser-backed Rust/WASM checks stay represented by focused unit, repository,
and host-adapter tests until the browser harness has bounded runtime again. The
quiet runner must not preflight Chrome or Firefox and must not call
`wasm-pack test --headless` while this suspension is active.
