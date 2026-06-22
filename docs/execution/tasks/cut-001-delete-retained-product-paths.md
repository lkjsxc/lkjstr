# CUT-001 Delete Retained Product Paths

## Purpose

Delete retained TypeScript or Svelte product paths only after parity, proof, and final gates.

## Status

blocked

## Current Evidence

- deletion ledger rows remain blocked except specific removed helpers

## Next Edit

Choose one row that is ready, run no-import proof, update ledgers, then delete only that row.

## Files To Read

- docs/agent/skills/deletion-proof.md
- docs/architecture/rust-wasm/cutover/deletion-ledger.md
- docs/architecture/rust-wasm/cutover/parity-ledger.md

## Files To Touch

- exact row files under src/lib/\*\*
- replacement Rust paths
- tests and ledgers

## Focused Gate

```sh
rg <exact patterns> src tests scripts
pnpm check:repo
pnpm verify:quiet
```

## Acceptance

Removed files are named, replacement Rust paths pass focused tests, and Docker final gate status is recorded.

## Must Not

- Do not delete from partial or blocked rows.
- Do not keep compatibility aliases.
