# Source Map

## Purpose

This file maps the shipped browser app, the Rust/WASM target, storage workers,
and verification files at a level that helps agents choose the right contract
before editing source.

## Current Runtime Paths

- `src/routes/+page.svelte`: renders the workspace at `/`.
- `src/lib/components/workspace/`: pane, tab strip, resize, and drop chrome.
- `src/lib/tabs/`: Svelte tab surfaces that remain the shipped product UI.
- `src/lib/workspace/`: pure workspace reducers, snapshots, and tab runtime
  ownership helpers.
- `src/lib/timeline/`, `src/lib/profile/`, `src/lib/thread/`, and
  `src/lib/notifications/`: shipped feed runtimes and tab-owned loaders.
- `src/lib/relays/`: relay clients, pool, routing, request budgets,
  orchestration adapters, and diagnostics.
- `src/lib/protocol/`: TypeScript protocol helpers used by shipped Svelte
  surfaces while Rust parity lands.
- `src/lib/storage/sqlite-opfs/`: current TypeScript SQLite worker host glue.
- `src/lib/storage/repositories/`: typed storage repositories used by product
  modules.

## Rust And WASM Paths

- `crates/lkjstr-protocol`: pure Nostr protocol kernel.
- `crates/lkjstr-domain`: pure workspace, account, relay-set, and draft models.
- `crates/lkjstr-relays`: pure relay state machines, leases, budgets, and route
  planning.
- `crates/lkjstr-storage`: manifest, table records, SQLite row codecs, and
  storage outcome contracts.
- `crates/lkjstr-app`: browser-local app composition and pure feed planning.
- `crates/lkjstr-ui`: partial Leptos UI shell.
- `crates/lkjstr-web`: WASM entrypoint and browser host adapters.
- `crates/lkjstr-xtask`: documentation, line, storage manifest, Rust style, and
  quiet verification checks.

## Effect Boundaries

- Browser storage effects stay inside SQLite worker clients and repositories.
- WebSocket effects stay inside relay client and host adapter modules.
- Signing effects stay inside account signer adapters.
- Fetch effects stay inside relay metadata, NIP-05, media, zap, and protocol
  discovery adapters.
- Timers and background work stay owner-scoped through runtime factories and the
  background task queue.

## Test And Operations Paths

- `tests/unit/`: focused TypeScript and Svelte-adjacent unit tests.
- `crates/*/tests/`: Rust crate integration tests.
- `scripts/check-repo.ts`: TypeScript repository guardrails.
- `docker-compose.yml`: final image-based verification surface.
- `Dockerfile`: image used by app, verify, Cloudflare, and smoke services.
- `.github/_README.md`: CI and GitHub automation map.

## Maintenance Notes

When a product surface moves from TypeScript to Rust/WASM, update this map,
[../current-state.md](../current-state.md), and
[rust-wasm/cutover/parity-ledger.md](rust-wasm/cutover/parity-ledger.md) in the
same change that deletes the replaced product path.
