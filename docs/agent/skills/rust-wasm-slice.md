# Skill: Rust WASM Slice

## Purpose

Move real product meaning into the Rust workspace in dependency order while
the shipped SvelteKit runtime stays intact until deletion proof exists. This
is the shared procedure; storage, relay, feed, and UI skills add area detail.

## Trigger

The change adds or extends behavior in `crates/`, a WASM bridge, or a Rust
host adapter consumed by the shipped app.

## Read First

- [../../architecture/rust-wasm/status.md](../../architecture/rust-wasm/status.md).
- [../../architecture/rust-wasm/surface-cutover-order.md](../../architecture/rust-wasm/surface-cutover-order.md).
- [../../architecture/rust-wasm/cutover/implementation-ledger.md](../../architecture/rust-wasm/cutover/implementation-ledger.md).
- [../../architecture/rust-wasm/crate-boundaries.md](../../architecture/rust-wasm/crate-boundaries.md).
- The area contract named by the blocker row in
  [../../execution/current-blockers.md](../../execution/current-blockers.md).

## Files Likely Touched

- Pure logic: `crates/lkjstr-protocol`, `crates/lkjstr-domain`,
  `crates/lkjstr-relays`, `crates/lkjstr-storage`, or `crates/lkjstr-app`
  by ownership.
- Browser effects and worker calls: `crates/lkjstr-web`.
- Leptos views: `crates/lkjstr-ui`.
- Matching docs, the Rust/WASM status file, and cutover ledgers.

## Procedure

1. Update the area contract and the Rust/WASM status doc to describe the
   intended slice before implementing.
2. Put pure reducers and codecs in the owning crate; keep browser effects
   behind explicit host adapters in `crates/lkjstr-web` with cleanup paths.
3. Compose product behavior in `crates/lkjstr-app`; render in
   `crates/lkjstr-ui` only with real data or explicit states.
4. Add crate tests next to the behavior. Use `wasm-pack` browser tests only
   for behavior Node cannot represent.
5. Update the implementation ledger row, and the parity ledger when a surface
   gains or loses parity. Record actual checks in the verification ledger.

## Focused Gate

```sh
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p <touched-crate>
pnpm rust-wasm:quiet
```

Add the area gate from
[../../operations/focused-gates.md](../../operations/focused-gates.md).

## Final Gate

Run the Docker final gate before any parity or cutover claim; otherwise
record it as not run.

## Must Not

- Do not use `unwrap`, `expect`, `todo`, `unimplemented`, panics, or unsafe
  code in production paths; see
  [../../repository/functional-style.md](../../repository/functional-style.md).
- Do not open SQLite or OPFS from the main thread or outside the worker-owned
  storage path.
- Do not mark a ledger row `implemented` while any required proof is missing.
- Do not delete TypeScript or Svelte product code in this skill; use
  [deletion-proof.md](deletion-proof.md).
- Do not add fake protocol results or placeholder success states; see
  [../no-fake-data.md](../no-fake-data.md).

## Handoff

Name the ledger rows updated, the crates touched, and the exact parity gaps
that remain open.
