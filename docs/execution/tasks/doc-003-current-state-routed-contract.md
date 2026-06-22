# DOC-003 Current-State Routed Contract

## Purpose

Keep implemented state concise while detailed truth lives in owned child files.

## Status

implemented

## Current Evidence

- `docs/current-state.md` routes to `docs/current-state/`
- checks pass

## Next Edit

Update the child file that owns the behavior when shipped state changes.

## Files To Read

- docs/current-state.md
- docs/current-state/README.md

## Files To Touch

- docs/current-state.md
- docs/current-state/\*_/_.md

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Acceptance

Current state remains a quick truth entry and child files own details.

## Must Not

- Do not leave competing current-state owners.
- Do not claim behavior source does not implement.
