# Rust WASM Audit Targets

## Purpose

This file names the next source paths and closing gates for Rust/WASM audit rows
that are partial or not implemented.

## Partial Rows

| Audit row                                 | Next source paths                                                                               | Closing gate                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Rust/WASM client ownership                | `docs/architecture/runtime-ownership.md`, `crates/lkjstr-web/`, `src/lib/tabs/`                 | `pnpm rust-wasm:quiet` plus focused surface tests                          |
| Rust/WASM architecture subtree            | `docs/architecture/rust-wasm/status.md`, `docs/architecture/rust-wasm/cutover/`                 | `pnpm check:repo`                                                          |
| Rust feed query input builders            | `crates/lkjstr-app/src/feed/`, `crates/lkjstr-app/tests/*input*`                                | `cargo test -p lkjstr-app -- feed`                                         |
| Rust Custom Request planner/provider      | `crates/lkjstr-app/src/custom_request/`, `crates/lkjstr-ui/src/workspace/`, `crates/lkjstr-web/src/` | `cargo test -p lkjstr-app -- custom_request` and WASM custom request tests |
| Rust workspace/settings IndexedDB adapter | `crates/lkjstr-web/src/storage/`, `src/lib/storage/sqlite-opfs/`                                | browser storage WASM tests and `pnpm test -- tests/unit/settings`          |
| Rust SQLite OPFS storage target           | `crates/lkjstr-storage/`, `crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/sqlite-opfs/` | `cargo test -p lkjstr-storage` and SQLite OPFS focused tests               |
| Rust relay client and browser adapters    | `crates/lkjstr-relays/src/client/`, `crates/lkjstr-web/src/relay*`, `src/lib/relays/`           | relay WASM host tests and relay unit tests                                 |
| Rust Leptos workspace shell               | `crates/lkjstr-ui/`, `crates/lkjstr-web/`, `src/lib/tabs/` deletion ledger                      | `trunk build --release` plus parity surface tests                          |
| Rust Settings surface                     | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/settings*`, `src/lib/settings/`                  | settings store tests plus `pnpm rust-wasm:quiet`                           |
| Rust Accounts surface                     | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/accounts*`, `src/lib/accounts/`                  | account tests plus secret redaction tests                                  |
| Rust Relay Settings surface               | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/relays*`, `src/lib/relays/`                      | relay settings and relay storage tests                                     |
| Rust Upload Settings surface              | `crates/lkjstr-ui/`, `crates/lkjstr-protocol/src/upload*`, `src/lib/media/`                     | protocol upload tests plus Upload Settings tests                           |
| Rust Tweet draft surface                  | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/tweet*`, `src/lib/tweet/`                        | Tweet draft and publish queue tests                                        |
| Docker Rust/WASM verification             | `Dockerfile`, `docker-compose.yml`, `crates/lkjstr-xtask/`                                      | Docker final gate from operations verification                             |

## Protected Storage Wiring Checklist

Source paths:

- `crates/lkjstr-web/src/sqlite_store/`: typed worker repository calls.
- `crates/lkjstr-web/src/*_host.rs`: Rust UI host providers.
- `crates/lkjstr-ui/src/workspace/stats*.rs`: Stats view model rendering.
- `crates/lkjstr-storage/src/stats.rs`: inventory and SQLite health snapshot
  contracts.

Data ownership:

- startup and workspace persistence use `workspaces` and `tab_states` through
  `workspace_host.rs`.
- Accounts use `accounts` and `local_account_secrets` through
  `accounts_host.rs`.
- Relay Settings use `relay_sets` plus local selected-set preference until the
  selected set has a protected table row.
- Upload Settings and Settings use flat `settings` rows.
- Tweet drafts use `tweet_drafts`.
- Stats reads SQLite schema table counts, SQLite worker health, and typed
  failure states.

Closing tests:

- `cargo test -p lkjstr-storage`.
- `pnpm rust-wasm:quiet`.
- SQLite worker browser tests when host behavior changes.

Deletion condition:

- Do not delete TypeScript storage repositories until Rust covers every live
  table family and no-import proof passes.

## Not Implemented Rows

| Audit row                               | Next source paths                                                                                                 | Closing gate                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Rust UI parity and snapshot persistence | `crates/lkjstr-ui/`, `crates/lkjstr-web/`, `docs/architecture/rust-wasm/cutover/`, replaced `src/lib/tabs/` paths | surface parity tests, `trunk build --release`, `pnpm verify:quiet`, and deletion ledger update |

## Completion Rule

A partial row can close only when the shipped product has one owner. If Rust
replaces a TypeScript or Svelte product path, delete the replaced path in the
same change and update the parity and deletion ledgers.
