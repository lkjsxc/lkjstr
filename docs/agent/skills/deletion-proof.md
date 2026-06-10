# Skill: Deletion Proof

## Purpose

Delete replaced TypeScript or Svelte product modules only after real Rust
parity, focused tests, ledger evidence, and no-import proof exist.

## Trigger

A cutover slice is ready to remove files under `src/lib/**` or
`src/routes/**`, or the user asks whether a module can be deleted.

## Read First

- [../../architecture/rust-wasm/cutover/deletion-ledger.md](../../architecture/rust-wasm/cutover/deletion-ledger.md),
  including the replacement source map row for the target module.
- [../../architecture/rust-wasm/cutover/parity-ledger.md](../../architecture/rust-wasm/cutover/parity-ledger.md).
- [../../architecture/rust-wasm/cutover/typescript-inventory.md](../../architecture/rust-wasm/cutover/typescript-inventory.md).
- [../../repository/workflow.md](../../repository/workflow.md).

## Files Likely Touched

- The exact removed files under `src/lib/**` or `src/routes/**`.
- The deletion ledger row, parity ledger row, and TypeScript inventory.
- [../../current-state.md](../../current-state.md) and the area contract when
  shipped ownership changes.

## Procedure

1. Confirm the parity ledger marks the replacement `implemented` with the
   named tests passing. A `partial` row stops this skill.
2. Run the no-import proof command from the deletion ledger row for the
   module group, plus any direct `rg` for the removed paths.
3. Delete the files and update the deletion ledger row with removed files,
   replacement Rust paths, proof command output, and gate status in the same
   change.
4. Update the TypeScript inventory and `docs/current-state.md` when shipped
   ownership changed.
5. Run the focused surface gate, the quiet gates, and the Docker final gate.

## Focused Gate

```sh
rg <patterns-from-the-deletion-ledger-row> src tests scripts
pnpm check:repo
pnpm verify:quiet
```

Plus the surface-specific focused tests named by the parity ledger row.

## Final Gate

Required. Run the full Docker final gate from
[../../operations/verification.md](../../operations/verification.md) before
the deletion claim. If it cannot run, the deletion does not land.

## Must Not

- Do not delete from a `partial` or `blocked` ledger row.
- Do not keep aliases or re-export shims for removed modules.
- Do not batch unrelated module groups into one deletion slice.
- Do not record no-import proof without pasting the actual command and its
  empty result.
- Do not delete browser host glue that the remaining runtime still needs
  without naming the carveout in the ledger row.

## Handoff

Paste the no-import command output, name the removed files and replacement
paths, and record the Docker final gate result.
