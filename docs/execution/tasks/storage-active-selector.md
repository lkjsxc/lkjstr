# Storage Active Selector

## Purpose

Route the Rust Accounts active-account selector through the SQLite worker. The
old `localStorage` key is migration-only evidence, not the product source.

## Current Evidence

- `lkjstr-storage/src/active_account.rs` defines protected selector rows without
  secret fields.
- `lkjstr-web/src/sqlite_store/active_account.rs` exposes typed worker get, put,
  and delete calls.
- `lkjstr-web/src/accounts_active.rs` still owns the old
  `lkjstr.activeAccountId` localStorage helper.
- `lkjstr-web/src/accounts_host.rs` still used that helper for active selection
  before this task.

## Target Behavior

- Account activation writes an `ActiveAccountSelectorRecord` through the SQLite
  worker after the target account is found.
- Account add and NIP-07 connect persist the selector through SQLite after the
  account save succeeds.
- Account removal deletes the SQLite selector when the removed account is active.
- Load reads SQLite first, migrates a matching old localStorage key only when no
  SQLite selector exists, removes the old key after successful SQLite write, and
  otherwise falls back to the first stored account with a SQLite selector write.
- SQLite unavailable, timeout, blocked, corrupt, canceled, or quota outcomes are
  shown as explicit Accounts status text and are not treated as selector absence.
- Protected account rows and local signing secrets are never pruned or logged.

## Files To Read

- `docs/execution/storage-slice.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `crates/lkjstr-storage/src/active_account.rs`.
- `crates/lkjstr-web/src/accounts_host.rs`.
- `crates/lkjstr-web/src/sqlite_store/active_account.rs`.

## Docs To Update First

- This task file.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md` when behavior or proof
  changes.
- `docs/architecture/rust-wasm/status.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-web/src/accounts_active.rs`.
- `crates/lkjstr-web/src/accounts_selector_host.rs`.
- `crates/lkjstr-web/src/accounts_host.rs`.
- Tests under `crates/lkjstr-web/tests/` when host behavior changes.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/accounts/**`, `src/lib/storage/**`, and Svelte tab surfaces until
Accounts parity, storage parity, no-import proof, and ledgers allow deletion.

## Tests To Add Or Update

- Selector get, put, and delete through the worker.
- Migration from the old localStorage key and old-key removal after success.
- Activation and fallback selector writes.
- Explicit status when selector read fails.
- Secret redaction assertions for selector JSON.

## Focused Gate

```sh
cargo test -p lkjstr-storage active_account
cargo test -p lkjstr-web active_account
cargo test -p lkjstr-web accounts
pnpm rust-wasm:quiet
```

## Final Gate

Run the Docker Compose final gate from `docs/operations/verification.md` before
claiming broad storage parity or deleting TypeScript or Svelte code.

## Commit Boundary

One commit should cover this task: docs, selector host helper, Accounts host
wiring, focused tests, and ledger evidence.

## Must Not

- Do not delete TypeScript or Svelte product paths.
- Do not add direct SQLite or OPFS access outside the worker.
- Do not use localStorage as a steady-state selector source.
- Do not log or display local signing secrets.
- Do not claim Accounts or storage cutover parity from this partial slice.
