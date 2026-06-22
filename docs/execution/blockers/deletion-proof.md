# Deletion proof

## Purpose

Deletion proof blocker details.

## Details

Prove imports are gone before deleting replaced TypeScript or Svelte product
paths.

- Cutover-ledger row: [Deletion ledger](../../architecture/rust-wasm/cutover/deletion-ledger.md).
- Docs to read: [cutover README](../../architecture/rust-wasm/cutover/README.md),
  [deletion ledger](../../architecture/rust-wasm/cutover/deletion-ledger.md),
  [parity ledger](../../architecture/rust-wasm/cutover/parity-ledger.md),
  [TypeScript inventory](../../architecture/rust-wasm/cutover/typescript-inventory.md),
  and [workflow](../../repository/workflow.md).
- Crates: replacement crate set named by the surface row.
- Shipped source paths: exact removed files under `src/lib/**` or
  `src/routes/**`, replacement Rust paths under `crates/lkjstr-*`, and tests
  under the surface focused gate.
- Focused tests: `rg` no-import proof for the target paths,
  `pnpm check:repo`, surface focused Rust tests, surface focused TypeScript
  tests while Svelte remains owner, `pnpm verify:quiet`, and Docker final gate
  before broad deletion claims.
- Completion proof: deletion ledger names removed files, replacement Rust paths,
  no-import command output, focused tests, and actual final-gate status. No
  partial row allows deletion.
