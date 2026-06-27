# CLOUDFLARE-WASM-PRODUCTION-REPAIR: Strict hosted bridge assets

## Purpose

Repair the production Rust/WASM bridge build boundary so `lkjstr.com` cannot
publish a SvelteKit shell without the feed bridge assets required by shipped Rust
islands.

## Status

repository repair implemented. Hosted deploy remains pending until Cloudflare
credentials are available.

## Current Evidence

- The incident showed `wasm-pack unavailable: spawnSync wasm-pack ENOENT` while
  feed surfaces needed the Rust/WASM bridge.
- The old Vite plugin owned `wasm-pack` execution and generated artifacts under
  `node_modules/.lkjstr`.
- Cloudflare docs allowed hosted builds to succeed without `wasm-pack`.
- The smoke test checked only `/` and `workspace-shell`, not bridge assets.
- `pnpm build`, `pnpm cloudflare:dry-run:built`, Docker `cloudflare`, and Docker
  `app-smoke` now verify the bridge manifest, JavaScript asset, and WASM bytes.

## Next Edit

Deploy from the documented Cloudflare path when credentials are available, then
run the hosted manifest and WASM byte checks.

## Files To Read

- docs/architecture/rust-wasm/toolchain-boundary.md
- docs/operations/cloudflare-workers.md
- docs/architecture/rust-wasm/cutover/root-build.md
- scripts/wasm-toolchain.ts
- scripts/vite-lkjstr-web-wasm.ts
- scripts/app-smoke.ts
- tests/unit/rust-wasm/vite-wasm-plugin.test.ts

## Files To Touch

- docs/current-state.md
- docs/architecture/rust-wasm/toolchain-boundary.md
- docs/operations/cloudflare-workers.md
- docs/operations/verification.md
- docs/execution/tasks/README.md
- scripts/build-lkjstr-web-wasm.ts
- scripts/verify-built-wasm-assets.ts
- scripts/vite-lkjstr-web-wasm.ts
- scripts/app-smoke.ts
- package.json
- tests/unit/rust-wasm/\*\*

## Focused Gate

```sh
pnpm test -- tests/unit/rust-wasm
pnpm check:repo
pnpm rust-wasm:build
pnpm build
pnpm verify:wasm-assets
pnpm cloudflare:dry-run:built
```

## Acceptance

Production build commands build Rust/WASM before Vite, Vite only consumes
existing bridge assets, the emitted Cloudflare output contains a manifest,
JavaScript bridge asset, and valid WASM binary, app smoke fails if those assets
are missing, and Docker `cloudflare` plus `app-smoke` prove the same boundary.

## Must Not

- Do not add fake feed rows, mock relay data, or placeholder success states.
- Do not let hosted production deploy without bridge assets.
- Do not run `wasm-pack`, `cargo`, or shell commands inside the Vite plugin.
- Do not store generated bridge artifacts under `node_modules`.
- Do not add a relay proxy, backend account system, signing custody service, or
  Cloudflare storage owner.
- Do not delete retained TypeScript or Svelte product paths without deletion
  proof.
