# Cloudflare Workers

## Purpose

Cloudflare Workers docs define the hosted build target for lkjstr.

## Contract

- Cloudflare Workers is a hosting target for the SvelteKit app shell.
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
- The compatibility date is `2026-05-23`.
- The only compatibility flag is `nodejs_als`.
- Repository scripts provide a dry-run verification command only; publishing is
  intentionally not scripted.

## Verification

```sh
pnpm cloudflare:dry-run
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build cloudflare
docker compose -f docker-compose.yml run --rm cloudflare
```

## References

- Cloudflare Workers SvelteKit guide:
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/svelte/>
- SvelteKit Cloudflare adapter docs:
  <https://svelte.dev/docs/kit/adapter-cloudflare>
