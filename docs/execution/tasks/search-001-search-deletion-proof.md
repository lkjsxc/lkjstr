# SEARCH-001 Search Deletion Proof

## Purpose

Remove retained Search query-runner paths only after the partial Search row reaches deletion readiness.

## Status

blocked

## Current Evidence

- Search product imports of `search-query.ts` are guarded absent
- parity ledger remains partial

## Next Edit

Complete parity proof, then run no-import commands and update deletion ledgers before removing files.

## Files To Read

- docs/agent/skills/search-runtime.md
- docs/agent/skills/deletion-proof.md
- docs/architecture/rust-wasm/cutover/deletion-ledger.md

## Files To Touch

- src/lib/search/\*\*
- src/lib/tabs/search/\*\*
- crates/lkjstr-app/\*\*
- crates/lkjstr-ui/\*\*

## Focused Gate

```sh
rg "search-query|query-runner|SearchTab" src tests scripts
pnpm check:repo
pnpm verify:quiet
```

## Acceptance

No retained product imports remain and Docker final gate passes before deletion.

## Must Not

- Do not delete while the parity ledger says partial.
