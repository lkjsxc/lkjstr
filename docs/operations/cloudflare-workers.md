# Cloudflare Workers

## Purpose

Cloudflare Workers docs define the hosted build target for lkjstr.

## Contract

- Cloudflare Workers is currently a hosting target for the SvelteKit app shell.
- Core lkjstr behavior stays browser-first: relay reads and writes use browser
  WebSockets, cache state uses browser storage, and signing remains local or
  extension-backed.
- The Cloudflare target does not add a relay proxy, Cloudflare storage
  dependency, or required backend account system.
- The app uses `@sveltejs/adapter-cloudflare` and Workers Static Assets.
- The Wrangler configuration lives at `wrangler.jsonc`.
- The Wrangler entry point is `.svelte-kit/cloudflare/_worker.js`.
- Static assets are served from `.svelte-kit/cloudflare` through the `ASSETS`
  binding.
- Storage uses `opfs-sahpool` by default, so the Cloudflare target does not add
  COOP/COEP headers solely for SQLite.
- Hosted `lkjstr.com` builds require Node 24, pnpm 11.1.2, Rust stable,
  `wasm32-unknown-unknown`, and `wasm-pack 0.15.0`.
- Browser bridge dependencies must stay pure Rust for Workers Builds and must
  not require `clang` or another C compiler to compile production WASM.
- The Cloudflare build path runs the explicit Rust/WASM bridge build before
  `vite build`.
- The dry-run path verifies bridge assets before `wrangler deploy --dry-run`.
- A hosted build missing `wasm-pack` either bootstraps the pinned Rust/WASM
  toolchain in Workers Builds or fails before deployment. It must not publish an
  app shell that can only show bridge-unavailable because the build tool was
  absent.
- Final root build cutover changes the asset directory to the Rust/Leptos
  static artifact only after product parity and no-import proof exist.
- An optional Rust Worker may route assets, SPA fallback, headers, and
  diagnostics only. It must not add backend account, storage, relay, signing, or
  feed behavior.
- The compatibility date is `2026-05-23`.
- The only compatibility flag is `nodejs_als`.
- Repository scripts provide dry-run verification; publishing requires explicit
  operator credentials.

## Deployment Settings

Supported Cloudflare build and deploy modes live in
[cloudflare-workers/build-settings.md](cloudflare-workers/build-settings.md).
The preferred durable path is GitHub Actions or pinned Docker after the Docker
final gate. Dashboard Workers Builds may use `pnpm build`; the checked-in build
script detects the Workers Build home and bootstraps the pinned Rust target plus
`wasm-pack` before compiling bridge assets.

## Verification

```sh
pnpm build
pnpm verify:wasm-assets
pnpm cloudflare:dry-run:built
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build cloudflare app-smoke
docker compose -f docker-compose.yml run --rm cloudflare
docker compose -f docker-compose.yml run --rm app-smoke
```

## References

- Cloudflare Workers SvelteKit guide:
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/svelte/>
- Cloudflare Workers Static Assets:
  <https://developers.cloudflare.com/workers/static-assets/>
- Cloudflare Workers Rust guide:
  <https://developers.cloudflare.com/workers/languages/rust/>
- SvelteKit Cloudflare adapter docs:
  <https://svelte.dev/docs/kit/adapter-cloudflare>
