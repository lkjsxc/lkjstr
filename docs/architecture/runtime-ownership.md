# Runtime Ownership

## Purpose

This file states which runtime owns each product responsibility while the app
ships SvelteKit and moves pure kernels into Rust/WASM.

## Current Ownership

| Area                | Owner                                         | Contract                                        |
| ------------------- | --------------------------------------------- | ----------------------------------------------- |
| UI rendering        | SvelteKit in `src/`                           | Shipped workspace and tab surfaces              |
| Workspace reducers  | TypeScript now, Rust parity in progress       | Pure layout and tab commands                    |
| Protocol validation | Rust target, TypeScript bridge still used     | Event, filter, relay URL, tag, and auth helpers |
| Relay state         | TypeScript shipped, Rust reducers in progress | WebSocket effects stay in host adapters         |
| Feed state          | TypeScript shipped, Rust planning in progress | Feed windows, route plans, and cache proof      |
| Storage             | SQLite worker repositories                    | Main thread never opens SQLite or OPFS directly |
| Signing             | Account signer adapters                       | NIP-07 and local signing are explicit effects   |
| Diagnostics         | Runtime counters plus SQLite rows             | Stats and Log render real bounded state         |

## Invariants

- Product behavior has one shipped owner at a time.
- Rust modules may be partial only when they are documented as parity work and
  cannot be reached as fake product success paths.
- TypeScript product code remains only while it is the implemented surface or
  browser host glue.
- Browser effects are isolated behind factories or host adapter functions.
- Pure reducers do not import Svelte, browser globals, WebSocket, storage, or
  timers.

## Browser Effect Boundary

Allowed browser-effect modules include:

- `src/lib/accounts/` for NIP-07 and local signing adapter calls.
- `src/lib/relays/relay-client.ts` and host modules for WebSocket transport.
- `src/lib/storage/sqlite-opfs/` and repositories for worker storage calls.
- `src/lib/media/`, `src/lib/profile/`, `src/lib/relays/relay-info-fetch.ts`,
  and zap helpers for fetch calls.
- `src/lib/background/` for owner-scoped work scheduling.
- `crates/lkjstr-web` for WASM browser host calls.

## Deletion Rule

When Rust/WASM reaches parity for a surface, delete the replaced TypeScript or
Svelte product path in the same coherent change. Record evidence in
[rust-wasm/cutover/parity-ledger.md](rust-wasm/cutover/parity-ledger.md) and
[rust-wasm/cutover/deletion-ledger.md](rust-wasm/cutover/deletion-ledger.md).

## Verification

- `pnpm check:repo`
- `pnpm test:quiet`
- `pnpm rust-wasm:quiet`
- `cargo run -p lkjstr-xtask -- check-rust-style`
