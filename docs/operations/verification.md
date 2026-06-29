# Verification

## Purpose

Verification proves documentation rules, source shape, focused behavior tests,
Rust/WASM checks, production build output, Cloudflare deployability, bridge asset
availability, and the production root response. Browser workflow suites and
browser-backed e2e suites are not canonical gates. Detailed commands live in
[verification/README.md](verification/README.md).

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

## Temporary E2E Suspension

Automated browser-backed e2e and wasm-pack browser harness tests are suspended
from local quiet gates, Docker verification, and CI/CD until their runtime is
bounded again. Automatic GitHub Actions are repository-only during long-action
suspension and must not run Docker final gates, publishing, deploys, Playwright,
browser workflow suites, or `wasm-pack test --headless`. Keep using unit,
repository, Rust, build, Cloudflare, and smoke checks locally or manually.

## Bridge Asset Gates

Production builds must build and verify the Rust/WASM bridge before deploy:

```sh
pnpm rust-wasm:build
pnpm build
pnpm verify:wasm-assets
pnpm cloudflare:smoke:built
pnpm cloudflare:dry-run:built
```

`pnpm verify:wasm-assets` checks source artifacts under `target/lkjstr-web-wasm`,
emitted Cloudflare assets under `.svelte-kit/cloudflare/lkjstr-web-wasm`,
manifest-tracked bridge imports such as wasm-bindgen snippets, and manifest
`Cache-Control: no-cache` header emission. The Cloudflare smoke gate starts the
built Worker locally, exercises `/` through the `ASSETS` binding, fetches the
manifest, JavaScript bridge, WASM binary, and manifest-tracked bridge imports,
validates content headers, checks digest integrity, and proves missing bridge
assets are not masked by root HTML fallback.

## Docker Final Gate

Docker Compose is the authoritative final gate:

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

The Docker `cloudflare` service verifies bridge assets, local Worker root
response, and asset routes before Wrangler dry-run. The Docker `app-smoke`
service verifies the preview root and bridge assets.

## Toolchain Boundary

Rust/WASM tools such as `wasm-pack` are build/check dependencies, not product
runtime dependencies. Missing required tools fail verification with actionable
instructions; local browser surfaces render explicit bridge-unavailable states
instead of raw spawn errors. Hosted production builds fail before deploy when the
bridge cannot be built or emitted. See
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
