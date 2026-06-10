# Storage Active Selector

## Purpose

Record the implemented active-account selector storage slice and the proof that
must be preserved while surrounding Accounts and storage product paths remain
partial.

## Status

Implemented. Retain this file as closed evidence until broader Accounts and
storage cutover work removes the surrounding TypeScript product paths with
parity and no-import proof.

## Current Evidence

- Storage row-codec proof lives in `crates/lkjstr-storage` active-account tests.
- Worker and product-host proof lives in `crates/lkjstr-web` active-account and
  accounts tests.
- Cutover status remains partial in
  `docs/architecture/rust-wasm/cutover/areas/storage.md` because Accounts
  parity, local secret safety proof, and TypeScript deletion proof remain open.

## Next Edit

Preserve selector behavior while broader Accounts parity, storage parity, and
deletion-proof work continues.

## Acceptance

Future storage work preserves the selector source, migration-only old key,
visible failure states, secret redaction, and no deletion.

## Implemented Behavior

- `lkjstr-storage/src/active_account.rs` defines protected selector rows without
  secret fields.
- `lkjstr-web/src/sqlite_store/active_account.rs` exposes typed worker get,
  put, and delete calls.
- Rust Accounts loads the selector from SQLite first.
- The old `lkjstr.activeAccountId` localStorage key is migration-only evidence.
- A matching old key is removed after a successful SQLite selector write.
- Account activation, account add, NIP-07 connect, fallback selection, and
  active-account removal update the SQLite selector row.
- Selector read, write, delete, unavailable, timeout, blocked, corrupt,
  canceled, and quota outcomes surface as explicit Accounts status text.
- Protected account rows and local signing secrets are never pruned or logged.

## Preservation Rule

Future storage work may refactor command metadata, worker envelopes, or Accounts
hosts only if these behaviors stay true:

- SQLite remains the steady-state selector source.
- localStorage remains migration-only.
- selector failures are visible and are not treated as absence.
- selector rows never contain secret material.
- no TypeScript or Svelte Accounts path is deleted from this closed evidence.

## Files To Read

- `docs/execution/storage-slice.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `crates/lkjstr-storage/src/active_account.rs`.
- `crates/lkjstr-web/src/accounts_active.rs`.
- `crates/lkjstr-web/src/accounts_host.rs`.
- `crates/lkjstr-web/src/sqlite_store/active_account.rs`.

## Files To Touch

- `crates/lkjstr-storage/src/active_account.rs`.
- `crates/lkjstr-web/src/accounts_active.rs`.
- `crates/lkjstr-web/src/accounts_host.rs`.
- `crates/lkjstr-web/src/sqlite_store/active_account.rs`.
- Storage and Accounts docs only when behavior changes.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/accounts/**`, `src/lib/storage/**`, and Svelte tab surfaces until
Accounts parity, storage parity, no-import proof, and ledgers allow deletion.

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

## Must Not

- Do not use localStorage as a steady-state selector source.
- Do not delete TypeScript or Svelte product paths.
- Do not add direct SQLite or OPFS access outside the worker.
- Do not log or display local signing secrets.
- Do not claim Accounts or storage cutover parity from this closed slice.
