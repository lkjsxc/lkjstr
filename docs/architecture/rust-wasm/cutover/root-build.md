# Root Build Cutover

## Purpose

This file defines the intended root browser build after product surfaces move
from SvelteKit-owned runtime code to Rust/Leptos-owned runtime code.

## Current State

The shipped app is a SvelteKit shell deployed through
`@sveltejs/adapter-cloudflare`. `wrangler.jsonc` points at
`.svelte-kit/cloudflare/_worker.js` and serves static assets from
`.svelte-kit/cloudflare`. Rust/WASM slices load inside that shipped shell while
they gain real product behavior. During this transition, the bridge artifacts are
built outside Vite, written to `target/lkjstr-web-wasm`, and then consumed by
Vite for static emission.

## Transition State

SvelteKit remains the host while product surfaces move into Rust crates:

- `lkjstr-storage` owns storage policy, commands, manifests, rows, and outcomes.
- `lkjstr-relays` owns relay state machines, budgets, leases, and snapshots.
- `lkjstr-app` owns browser-local product composition and view models.
- `lkjstr-ui` owns Leptos rendering.
- `lkjstr-web` owns the WASM entrypoint and browser host adapters.

TypeScript and Svelte product modules stay until Rust parity, focused tests,
ledger evidence, and no-import proof exist for the exact replacement paths.

Immediate bridge build ownership is transitional but strict:

- SvelteKit remains the deployed shell.
- `pnpm rust-wasm:build` owns `wasm-pack` preflight and bridge generation.
- Vite consumes existing bridge artifacts and emits them with a manifest.
- Cloudflare dry-run and app smoke fail when bridge assets are missing.

## Final State

The root artifact is a Rust/Leptos static browser app. Cloudflare Workers Static
Assets serves that artifact. `wrangler.jsonc` changes to the Rust static output
only after every root workspace contract is Rust-owned and verified.

The optional Rust Worker layer may handle only static routing, SPA fallback,
headers, and diagnostics. It must not own accounts, signing, browser storage,
relay proxying, feeds, uploads, or product data.

## Target Layout

- `crates/lkjstr-web`: browser WASM entrypoint and host adapters.
- `crates/lkjstr-ui`: Leptos components and rendering contracts.
- `crates/lkjstr-app`: browser-local product services and view models.
- `static/`: hand-authored static media and manifest assets.
- `public/` or `web/`: root HTML shell after SvelteKit removal.
- `dist/` or `build/cloudflare/`: generated Cloudflare static artifact.
- `crates/lkjstr-worker`: optional static router only.

## Build Command Target

`cargo run -p lkjstr-xtask -- build-web` is the target final build command. It
must build the browser WASM artifact, copy SQLite WASM assets, copy static
assets, validate the root HTML shell, validate Cloudflare asset paths, and prove
no SvelteKit imports remain when final root cutover is claimed. Until that
broader cutover exists, `pnpm rust-wasm:build && pnpm build` is the immediate
SvelteKit-hosted production bridge contract.

## Cutover Gate

Do not switch Wrangler to the Rust static artifact until product surfaces,
startup recovery, SQLite asset emission, focused Rust tests, local quiet gates,
Cloudflare dry-run, app smoke, deletion ledgers, and Docker Compose final gates
all match the root build claim.
