# Toolchain Boundary

## Purpose

This contract separates Rust/WASM build and test tools from browser product
runtime behavior.

## Contract

`wasm-pack` is a developer, CI, Docker, and hosted production build tool. It is
not a product runtime dependency. Browser code must never spawn `wasm-pack`,
`cargo`, Trunk, package-manager installs, shell scripts, or other build tools.

Build, check, Cloudflare, and Docker commands own toolchain preflight. When a
required tool or browser is missing, those commands fail with an actionable
diagnostic that names the missing dependency and the install or Docker
verification path. They must not expose raw Node spawn errors or browser-driver
crashes as the primary message.

Production and Cloudflare builds are strict. If shipped Rust/WASM bridge
artifacts cannot be built before Vite or emitted into the static output, the
build fails before deploy. A hosted production build that would only show a
missing-bridge state because `wasm-pack` was absent is a release blocker.

The explicit Rust/WASM build owner generates bridge artifacts before Vite. The
Vite plugin is an asset consumer and emitter only: it reads existing artifacts,
serves them in dev, emits them for static hosting, and generates the browser
virtual module. It does not run toolchain commands.

Product browser runtime only loads already-built Rust/WASM assets. Local
development may render an explicit bridge-unavailable state when artifacts are
absent. Hosted production must instead prove the bridge assets exist during
build and smoke verification.

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

`pnpm rust-wasm:build` builds the browser bridge artifacts. `pnpm build`,
`pnpm cloudflare:dry-run`, Docker `cloudflare`, and CI fail if those artifacts
are missing or invalid.

`pnpm rust-wasm:quiet` and `cargo run -p lkjstr-xtask -- quiet rust-wasm` still
run the Rust/WASM matrix when tools and browsers are present. Missing
`wasm-pack`, Chrome, or Firefox fails at the preflight boundary with install and
Docker instructions.

Docker Compose is authoritative for final verification. The Docker image installs
pinned Rust/WASM tools and must not rely on host-installed `wasm-pack` or a
host-mounted source tree.
