# DOC-002 Split Execution And Verification Docs

## Purpose

Keep execution and verification maps concise by routing details into child files.

## Status

implemented

## Current Evidence

- current blockers, verification, and focused gates now route to child files
- checks pass

## Next Edit

Keep new gate details in child files instead of growing root maps.

## Files To Read

- docs/execution/current-blockers.md
- docs/operations/verification.md
- docs/operations/focused-gates.md

## Files To Touch

- docs/execution/blockers/\*\*
- docs/operations/verification/\*\*
- docs/operations/focused-gates/\*\*

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Acceptance

Root maps stay concise and every child remains linked from the owning README.

## Must Not

- Do not duplicate canonical gate commands in multiple owners.
