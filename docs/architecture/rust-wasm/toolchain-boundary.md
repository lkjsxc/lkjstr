# Toolchain Boundary

## Purpose

This contract separates Rust/WASM build and test tools from browser product
runtime behavior.

## Contract

`wasm-pack` is a developer, CI, and Docker build/test tool. It is not a product
runtime dependency. Browser code must never spawn `wasm-pack`, `cargo`, Trunk,
or other build tools.

Build, check, and verification commands own toolchain preflight. When a required
tool is missing, those commands fail with an actionable diagnostic that names the
missing tool and the install or Docker verification path. They must not expose raw
Node spawn errors as the primary message.

Product browser runtime only loads already-built Rust/WASM assets. If those
assets are missing or the bridge cannot initialize, the runtime renders an
explicit bridge-unavailable state and keeps the surface non-successful.

## Product Error Text

Timeline, feed surfaces, Rust islands, Stats diagnostics, and feed-surface debug
views must not render raw toolchain errors such as `spawnSync wasm-pack ENOENT`.
Use concise product text instead:

```text
Rust/WASM bridge unavailable: local WASM artifact is missing. Run pnpm rust-wasm:quiet or use Docker verification.
```

This state is not an empty feed, not a successful bridge load, and not fake Rust
output. It only reports that local browser WASM artifacts are unavailable.

## Verification

`pnpm rust-wasm:quiet` and `cargo run -p lkjstr-xtask -- quiet rust-wasm` must
still run the Rust/WASM matrix when tools are present. Missing `wasm-pack` fails
at the preflight boundary with the install and Docker instructions.

Docker Compose is authoritative for final verification. The Docker image installs
pinned Rust/WASM tools and must not rely on host-installed `wasm-pack` or a
host-mounted source tree.
