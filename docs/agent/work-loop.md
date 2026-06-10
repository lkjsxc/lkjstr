# Work Loop

## Purpose

This file defines the change loop every autonomous slice follows, from cold
start to handoff. It replaces the older execution agent-route file and is the
single owner of the per-change loop. The entry read order lives in
`AGENTS.md`.

## Loop

1. Orient. Read [../current-state.md](../current-state.md), then
   [../execution/current-blockers.md](../execution/current-blockers.md).
2. Choose the task. Use the task the user named, otherwise the first
   incomplete blocker. Granular task files live under
   [../execution/tasks/README.md](../execution/tasks/README.md).
3. Match a skill in [skills/README.md](skills/README.md) and read its
   read-first files before editing.
4. Update the affected docs first: the area contract, then
   [../current-state.md](../current-state.md) when shipped behavior changes.
5. Implement the narrowest matching source change. Respect
   [no-fake-data.md](no-fake-data.md) and the skill must-not rules.
6. Add or update focused tests at the same ownership level as the behavior.
7. Run the focused gate named by the skill or task file.
8. Update ledgers with implemented truth only (list below).
9. Run the pre-handoff gates for the change class (table below).
10. Hand off using [handoff.md](handoff.md).

## Verification Choice

| Change class                 | Required gates beyond the focused gate                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Docs only                    | `pnpm check:repo`, `cargo run -p lkjstr-xtask -- check-docs`, `cargo run -p lkjstr-xtask -- check-lines` |
| TypeScript or Svelte product | `pnpm verify:quiet`                                                                                      |
| Rust or WASM                 | `cargo fmt --check`, crate-scoped clippy, `pnpm rust-wasm:quiet`                                         |
| Scripts, checks, or CI       | `pnpm check:repo`, `pnpm test:quiet`, the affected quiet command                                         |
| Deletion or cutover claim    | no-import proof, `pnpm verify:quiet`, Docker final gate                                                  |

Area-specific focused gates live in
[../operations/focused-gates.md](../operations/focused-gates.md). Docker
Compose final gate commands live in
[../operations/verification.md](../operations/verification.md). Run the final
gate before deletion claims, cutover claims, and major handoffs; otherwise
record that it was not run.

## Ledgers

Update ledgers only with implemented truth:

- [../execution/current-blockers.md](../execution/current-blockers.md) when
  blocker order or proof changes.
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

## Deletion Guard

Do not delete TypeScript or Svelte product code outside the procedure in
[skills/deletion-proof.md](skills/deletion-proof.md). A `partial` ledger row
never allows deletion.

## Stop Condition

A slice is ready only when docs, source, focused tests, ledgers, repository
checks, and the recorded verification evidence agree about the same current
behavior. If a gate cannot run, the handoff names the exact command, the
exact failure, and whether it is a code failure or an environment failure.
