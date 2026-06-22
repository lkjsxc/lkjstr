# Skill: Search Runtime

## Purpose

Move Search behavior into Rust/WASM without losing local token-index search,
NIP-50 relay merge truth, cancellation, snapshots, or deletion proof.

## Trigger

Use when editing Search product behavior, `src/lib/search`, Search tab glue,
Rust Search app/UI/Web providers, or Search storage rows.

## Read First

- [../../product/tools/search.md](../../product/tools/search.md).
- [../../architecture/runtimes/query-runtime.md](../../architecture/runtimes/query-runtime.md).
- [../../architecture/rust-wasm/cutover/parity-ledger.md](../../architecture/rust-wasm/cutover/parity-ledger.md).
- [../../architecture/rust-wasm/cutover/deletion-ledger.md](../../architecture/rust-wasm/cutover/deletion-ledger.md).
- [../../execution/tasks/search-feed-provider-wiring.md](../../execution/tasks/search-feed-provider-wiring.md).

## Files Likely Touched

- `crates/lkjstr-app/src/search*` and shared feed modules.
- `crates/lkjstr-storage/src/search.rs` and command metadata.
- `crates/lkjstr-web/src/search*` provider and host tests.
- `crates/lkjstr-ui/src/workspace/search*`.
- `src/lib/search/`, `src/lib/tabs/search/`, and Search tests.

## Procedure

1. Update the product/runtime contract before source.
2. Preserve local indexed rows as the local Search path; do not add broad cached-event scans.
3. Keep relay NIP-50 support bounded and diagnostic when unsupported or clamped.
4. Release replaced or unavailable provider leases before starting another query.
5. Record no-import proof before deleting retained TypeScript helpers.

## Focused Gate

```sh
pnpm test -- tests/unit/search/search-query.test.ts
cargo test -p lkjstr-app search
cargo test -p lkjstr-storage search
pnpm verify:quiet
```

## Final Gate

Run Docker final gate before claiming Search deletion or full parity.

## Must Not

- Do not synthesize Search results or NIP-50 support.
- Do not treat cache misses as proof that no matching event exists.
- Do not keep old query-runner imports after deletion proof.

## Handoff

List local-index proof, relay NIP-50 proof, no-import commands, retained Search
paths, and ledger updates.
