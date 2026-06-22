# Rust WASM Verification

## Purpose

Rust and host-boundary verification commands.

## Details

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
WASM boundary, and storage-host behavior that Node cannot represent. The quiet
runner preflights `wasm-pack` and reports the install or Docker path when the
tool is missing. It must use a Chromedriver major number that matches the
installed Chrome when a cached or PATH driver is available; a mismatched driver
is a harness blocker, not a reason to skip browser-backed tests.
