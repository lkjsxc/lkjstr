# Verification

## Purpose

Verification proves documentation rules, source shape, focused behavior tests,
Rust/WASM checks, production build output, Cloudflare deployability, and the
production root response. Browser workflow suites are not canonical gates.
Detailed commands live in [verification/README.md](verification/README.md).

## Canonical Local Gates

Run repository checks before implementation continues after a contract change:

```sh
pnpm check:repo
```

Run focused gates for the changed area, then quiet local gates when the slice
requires broader proof:

```sh
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
pnpm cloudflare:quiet
```

## Docker Final Gate

Docker Compose is the authoritative final gate:

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

## Toolchain Boundary

Rust/WASM tools such as `wasm-pack` are build/check dependencies, not product
runtime dependencies. Missing required tools fail verification with actionable
instructions; browser surfaces render explicit bridge-unavailable states instead
of raw spawn errors. See
[../architecture/rust-wasm/toolchain-boundary.md](../architecture/rust-wasm/toolchain-boundary.md).

## Detail Map

- [verification/quiet-contract.md](verification/quiet-contract.md): quiet command behavior, local gate, and duplicate-work rules.
- [verification/rust-wasm.md](verification/rust-wasm.md): Rust and browser host-boundary checks.
- [verification/sqlite-opfs.md](verification/sqlite-opfs.md): SQLite OPFS focused gate.
- [verification/docker-final-gate.md](verification/docker-final-gate.md): Docker final gate details.
- [verification/acceptance-checks.md](verification/acceptance-checks.md): automated and manual acceptance checks.
- [focused-gates.md](focused-gates.md): focused checks by change area.

## Rule

Do not claim a gate passed unless the command ran and exited successfully. Record
failed, skipped, or timed-out commands honestly in the handoff.
