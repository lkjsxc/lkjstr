# Rust WASM Audit Targets

## Purpose

This file names the next source paths and closing gates for Rust/WASM audit rows
that are partial or not implemented.

## Status Matrix

| Clause                                   | Contract                                                                       | Status          | Notes                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------- |
| Rust/WASM client ownership               | [rust-wasm-client.md](../../decisions/rust-wasm-client.md)                        | partial         | active slices tracked in Rust/WASM status                            |
| Rust/WASM architecture subtree           | [rust-wasm/README.md](../../architecture/rust-wasm/README.md)                     | partial         | status, cutover, and verification docs active                        |
| Rust workspace checks                    | [crate-boundaries.md](../../architecture/rust-wasm/crate-boundaries.md)           | implemented     | `lkjstr-xtask` commands                                              |
| Rust protocol event validation           | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | byte, event, policy, ID tests                                        |
| Rust protocol filters and relay messages | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | filter and message tests                                             |
| Rust protocol signing and verification   | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | crypto and verify tests                                              |
| Rust protocol NIP-19 entities            | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | NIP-19 Rust tests                                                    |
| Rust protocol relay URL normalization    | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | relay URL Rust tests                                                 |
| Rust protocol emoji and warnings         | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | NIP-30 and NIP-36 Rust tests                                         |
| Rust protocol tag and action helpers     | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | tag, reaction, builder tests                                         |
| Rust protocol emoji source helpers       | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | NIP-51 Rust tests                                                    |
| Rust protocol zaps and upload auth       | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | NIP-57, Blossom, NIP-96, NIP-98 tests                                |
| Rust protocol relay list metadata        | [protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md)             | implemented     | NIP-65 Rust tests                                                    |
| Rust protocol NIP-29 groups              | [nip29-groups.md](../../protocol/nip29-groups.md)                                 | partial         | constants and pure parser tests pass; group UI and publish open      |
| Rust protocol NIP-89 client tag          | [nip89-client-tag.md](../../protocol/nip89-client-tag.md)                         | partial         | Rust and TS tag-builder tests pass; shared publish enrichment active |
| Rust protocol WASM bridge                | [host-boundary.md](../../architecture/rust-wasm/host-boundary.md)                 | implemented     | browser WASM tests                                                   |
| Rust pure account domain                 | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | domain account tests                                                 |
| Rust workspace model basics              | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | domain workspace tests                                               |
| Rust workspace tab movement              | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | domain move tests                                                    |
| Rust New Tab catalog                     | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | domain catalog tests                                                 |
| Rust workspace snapshot payloads         | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | domain snapshot tests                                                |
| Rust workspace runtime composition       | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | app workspace tests                                                  |
| Rust startup tab snapshot recovery       | [app-boundary.md](../../architecture/rust-wasm/app-boundary.md)                   | implemented     | app and browser storage tests                                        |
| Rust feed query input builders           | [feed-surface-inputs.md](../../architecture/feeds/runtime/feed-surface-inputs.md) | partial         | feed, thread, author-context, search, custom-request app tests       |
| Rust Custom Request planner/provider     | [custom-request.md](../tools/custom-request.md)                                   | partial         | parser, clamp, run-planner, UI provider, and browser planning tests  |
| Rust storage manifest and outcomes       | [storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md)               | implemented     | storage crate tests                                                  |
| Rust event-cache row codecs              | [storage-wiring.md](../../architecture/rust-wasm/cutover/storage-wiring.md)       | implemented     | `event_cache_sqlite_rows_test.rs`                                    |
| Rust feed-coverage row codecs            | [storage-wiring.md](../../architecture/rust-wasm/cutover/storage-wiring.md)       | implemented     | `feed_cache_sqlite_rows_test.rs`                                     |
| Rust event cache product integration     | [storage-wiring.md](../../architecture/rust-wasm/cutover/storage-wiring.md)       | partial         | worker calls exist; cache proof and retention remain open            |
| Rust tab-state storage contract          | [storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md)               | implemented     | tab-state storage tests                                              |
| Rust workspace storage record            | [storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md)               | implemented     | workspace storage tests                                              |
| Rust IndexedDB host-boundary adapter     | [storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md)               | partial         | narrow WASM exports and browser storage tests                        |
| Rust SQLite OPFS storage target          | [sqlite-opfs/README.md](../../architecture/data/sqlite-opfs/README.md)            | partial         | schema, static worker, Rust adapter, protected product hosts         |
| Rust tab-state IndexedDB transaction     | [storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md)               | implemented     | snapshot and ledger browser test                                     |
| Rust relay state machine basics          | [relay-runtime.md](../../architecture/rust-wasm/relay-runtime.md)                 | implemented     | relay crate tests                                                    |
| Rust relay client and browser adapters   | [relay-runtime.md](../../architecture/rust-wasm/relay-runtime.md)                 | partial         | pure reducer plus WebSocket/timer adapters; product wiring open      |
| Rust Leptos workspace shell              | [ui-runtime.md](../../architecture/rust-wasm/ui-runtime.md)                       | partial         | Welcome, New Tab, SQLite persistence, Stats inventory                |
| Rust Settings surface                    | [settings.md](../tools/settings.md)                                               | partial         | flat schema and SQLite worker overrides; side effects open           |
| Rust follow-list extraction              | [followees.md](../feeds/followees.md)                                             | implemented     | `follow_list_test.rs` covers dedupe, invalid rows, and hints         |
| Rust Followees surface                   | [followees.md](../feeds/followees.md)                                             | partial         | Svelte action tab uses cached real kind `3`; relay runtime open      |
| Rust follow-count state                  | [profiles.md](../feeds/profiles.md)                                               | partial         | Rust state model and Profile UI wiring active                        |
| Rust User Timeline surface               | [user-timeline.md](../feeds/user-timeline.md)                                     | partial         | Svelte action tab uses cached real events; relay runtime open        |
| Rust cache-display policy                | [feed-memory.md](../../architecture/data/feed-memory.md)                          | partial         | Pure policy active; product cache promotion proof remains open       |
| Rust hydration priority reducer          | [feed-memory.md](../../architecture/data/feed-memory.md)                          | partial         | Pure scheduler active; shipped hydration wiring remains open         |
| Rust Search planning and indexing        | [search.md](../tools/search.md)                                                   | partial         | Token index and NIP-50 merge tests required before complete          |
| Rust Accounts surface                    | [accounts.md](../tools/accounts.md)                                               | partial         | SQLite rows, local secret transaction, NIP-07 connect                |
| Rust Relay Settings surface              | [relay-management.md](../tools/relay-management.md)                               | partial         | SQLite relay sets and default selection                              |
| Rust Upload Settings surface             | [upload-settings.md](../tools/upload-settings.md)                                 | partial         | media upload settings, Blossom endpoint display, NIP-96 discovery    |
| Rust Tweet draft surface                 | [tweet.md](../tools/tweet.md)                                                     | partial         | SQLite protected draft rows and editor                               |
| Rust UI parity and snapshot persistence  | [crate-boundaries.md](../../architecture/rust-wasm/crate-boundaries.md)           | not implemented | current runtime remains TS                                           |
| Rust cutover ledger                      | [cutover/README.md](../../architecture/rust-wasm/cutover/README.md)               | implemented     | status, parity, and deletion guard                                   |
| Docker Rust/WASM verification            | [verification.md](../../architecture/rust-wasm/verification.md)                   | partial         | verify target active; app build cutover open                         |

## Partial Rows

| Audit row                                 | Next source paths                                                                                    | Closing gate                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Rust/WASM client ownership                | `docs/architecture/runtime-ownership.md`, `crates/lkjstr-web/`, `src/lib/tabs/`                      | `pnpm rust-wasm:quiet` plus focused surface tests                          |
| Rust/WASM architecture subtree            | `docs/architecture/rust-wasm/status.md`, `docs/architecture/rust-wasm/cutover/`                      | `pnpm check:repo`                                                          |
| Rust feed query input builders            | `crates/lkjstr-app/src/feed/`, `crates/lkjstr-app/tests/*input*`                                     | `cargo test -p lkjstr-app -- feed`                                         |
| Rust Custom Request planner/provider      | `crates/lkjstr-app/src/custom_request/`, `crates/lkjstr-ui/src/workspace/`, `crates/lkjstr-web/src/` | `cargo test -p lkjstr-app -- custom_request` and WASM custom request tests |
| Rust workspace/settings IndexedDB adapter | `crates/lkjstr-web/src/storage/`, `src/lib/storage/sqlite-opfs/`                                     | browser storage WASM tests and `pnpm test -- tests/unit/settings`          |
| Rust SQLite OPFS storage target           | `crates/lkjstr-storage/`, `crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/sqlite-opfs/`      | `cargo test -p lkjstr-storage` and SQLite OPFS focused tests               |
| Rust relay client and browser adapters    | `crates/lkjstr-relays/src/client/`, `crates/lkjstr-web/src/relay*`, `src/lib/relays/`                | relay WASM host tests and relay unit tests                                 |
| Rust Leptos workspace shell               | `crates/lkjstr-ui/`, `crates/lkjstr-web/`, `src/lib/tabs/` deletion ledger                           | `trunk build --release` plus parity surface tests                          |
| Rust Settings surface                     | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/settings*`, `src/lib/settings/`                       | settings store tests plus `pnpm rust-wasm:quiet`                           |
| Rust Accounts surface                     | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/accounts*`, `src/lib/accounts/`                       | account tests plus secret redaction tests                                  |
| Rust Relay Settings surface               | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/relays*`, `src/lib/relays/`                           | relay settings and relay storage tests                                     |
| Rust Upload Settings surface              | `crates/lkjstr-ui/`, `crates/lkjstr-protocol/src/upload*`, `src/lib/media/`                          | protocol upload tests plus Upload Settings tests                           |
| Rust Tweet draft surface                  | `crates/lkjstr-ui/`, `crates/lkjstr-domain/src/tweet*`, `src/lib/tweet/`                             | Tweet draft and publish queue tests                                        |
| Docker Rust/WASM verification             | `Dockerfile`, `docker-compose.yml`, `crates/lkjstr-xtask/`                                           | Docker final gate from operations verification                             |

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
