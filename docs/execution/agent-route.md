# Agent Route

## Purpose

This file is the shortest execution route for agents. It answers what to read,
what to change first, which focused checks prove progress, which ledgers change,
and what must not be deleted.

## Read Order

1. `AGENTS.md`.
2. `README.md`.
3. [../README.md](../README.md).
4. [../current-state.md](../current-state.md).
5. [README.md](README.md).
6. [operating-rules.md](operating-rules.md).
7. [current-blockers.md](current-blockers.md).
8. The slice file named by the first blocker, currently
   [storage-slice.md](storage-slice.md).
9. The crate README for each crate touched by the slice.
10. [../operations/verification.md](../operations/verification.md).

## First Change

Start with the first blocker in [current-blockers.md](current-blockers.md).
For the current queue, change storage before relay, shared feed runtime, Home,
or deletion work:

- keep the table manifest, storage docs, and Rust metadata aligned;
- add row codecs and stable problem kinds for touched tables;
- add typed repository commands before product modules consume storage;
- keep all SQLite and OPFS effects inside the worker-owned storage path;
- update Stats only from real storage health, pressure rows, inventory, or an
  explicit unavailable state.

## Focused Proof

For the storage slice, run the focused gate from
[storage-slice.md](storage-slice.md):

```sh
cargo test -p lkjstr-storage
cargo test -p lkjstr-web
pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
pnpm rust-wasm:quiet
```

For a docs-only route change, run:

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

Use [../operations/focused-gates.md](../operations/focused-gates.md) when the
slice is relay, feed, Home, security, or deletion.

## Ledgers To Update

Update ledgers only with implemented truth:

- [current-blockers.md](current-blockers.md) when blocker order or proof changes.
- [../architecture/rust-wasm/cutover/implementation-ledger.md](../architecture/rust-wasm/cutover/implementation-ledger.md)
  when an area gains real behavior.
- [../architecture/rust-wasm/cutover/parity-ledger.md](../architecture/rust-wasm/cutover/parity-ledger.md)
  when a product surface reaches or loses parity.
- [../architecture/rust-wasm/cutover/deletion-ledger.md](../architecture/rust-wasm/cutover/deletion-ledger.md)
  only after removal and no-import proof.
- [../architecture/rust-wasm/cutover/verification-ledger.md](../architecture/rust-wasm/cutover/verification-ledger.md)
  with commands actually run.
- [../architecture/rust-wasm/cutover/typescript-inventory.md](../architecture/rust-wasm/cutover/typescript-inventory.md)
  when TypeScript ownership changes.

## Must Not Delete

Do not delete TypeScript or Svelte product code until all of these are true:

- Rust replacement behavior exists and renders real data or explicit loading,
  unavailable, unsupported, denied, or diagnostic states;
- focused Rust and host tests pass;
- the parity and deletion ledgers name the replacement modules;
- `rg` proves no imports of the removed path remain;
- `pnpm check:repo` and the relevant quiet gates pass.

## No Placeholder Rule

Product UI renders real Nostr events, real storage rows, real relay diagnostics,
explicit loading, explicit unavailable, explicit unsupported, explicit denied,
or real diagnostic states. Synthetic events and relays are test fixtures only.
