# CLOUDFLARE-WASM-PRODUCTION-REPAIR: Strict hosted bridge assets

## Purpose

Repair the production Rust/WASM bridge build boundary so `lkjstr.com` cannot
publish a SvelteKit shell without the feed bridge assets required by shipped Rust
islands.

## Status

repository repair implemented for bridge assets; active root Worker `500`
repair adds client-rendered root, local Worker smoke, strict hosted smoke, and
manifest header proof. Hosted deploy remains pending until Cloudflare credentials
are available.

## Current Evidence

- The incident showed `wasm-pack unavailable: spawnSync wasm-pack ENOENT` while
  feed surfaces needed the Rust/WASM bridge.
- The old Vite plugin owned `wasm-pack` execution and generated artifacts under
  `node_modules/.lkjstr`.
- Cloudflare docs allowed hosted builds to succeed without `wasm-pack`.
- The smoke test checked only `/` and `workspace-shell`, not bridge assets.
- `pnpm build`, `pnpm cloudflare:dry-run:built`, Docker `cloudflare`, and Docker
  `app-smoke` now verify the bridge manifest, JavaScript asset, and WASM bytes.
- The reported hosted `500 Internal Error` is reproduced by local Wrangler root
  rendering when the Worker evaluates browser-only root modules.
- The root route is client-rendered, and production smoke checks assert `/` is a
  successful app shell rather than a SvelteKit `500` page.
- Workers Builds running `pnpm build` bootstrap Rust stable, the wasm32 target,
  and `wasm-pack 0.15.0` before failing or compiling bridge assets.
- Bridge crypto moved off `secp256k1-sys`, so Workers Builds do not need `clang`
  to compile the production WASM bridge.

## Next Edit

Run the focused production repair gates, deploy from the documented Cloudflare
path when credentials are available, then run the hosted root and bridge checks.

## Files To Read

- docs/architecture/rust-wasm/toolchain-boundary.md
- docs/operations/cloudflare-workers.md
- docs/architecture/rust-wasm/cutover/root-build.md
- scripts/wasm-toolchain.ts
- scripts/vite-lkjstr-web-wasm.ts
- scripts/app-smoke.ts
- scripts/hosted-smoke.ts
- scripts/cloudflare-worker-smoke.ts
- tests/unit/rust-wasm/vite-wasm-plugin.test.ts

## Files To Touch

- docs/current-state.md
- docs/architecture/rust-wasm/toolchain-boundary.md
- docs/operations/cloudflare-workers.md
- docs/operations/verification.md
- docs/execution/tasks/README.md
- scripts/build-lkjstr-web-wasm.ts
- scripts/install-wasm-toolchain.ts
- scripts/verify-built-wasm-assets.ts
- scripts/vite-lkjstr-web-wasm.ts
- scripts/app-smoke.ts
- package.json
- crates/lkjstr-protocol/\*\*
- tests/unit/rust-wasm/\*\*

## Focused Gate

```sh
pnpm test -- tests/unit/rust-wasm tests/unit/routes
pnpm check:repo
pnpm rust-wasm:build
pnpm build
pnpm verify:wasm-assets
pnpm cloudflare:smoke:built
pnpm cloudflare:dry-run:built
```

## Acceptance

Production build commands build Rust/WASM before Vite, Vite only consumes
existing bridge assets, the emitted Cloudflare output contains a manifest,
JavaScript bridge asset, valid WASM binary, and no-cache manifest header, local
Worker smoke fails on root `500` or masked bridge assets, hosted smoke checks the
same public paths after deploy, and Docker `cloudflare` plus `app-smoke` prove
the same boundary.

## Must Not

- Do not add fake feed rows, mock relay data, or placeholder success states.
- Do not let hosted production deploy without bridge assets.
- Do not run `wasm-pack`, `cargo`, or shell commands inside the Vite plugin.
- Do not store generated bridge artifacts under `node_modules`.
- Do not add a relay proxy, backend account system, signing custody service, or
  Cloudflare storage owner.
- Do not delete retained TypeScript or Svelte product paths without deletion
  proof.
