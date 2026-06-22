# DOC-004 README Recursive TOCs

## Purpose

Keep every docs directory discoverable through a local README and recursive TOC.

## Status

implemented

## Current Evidence

- `pnpm check:repo` and `check-docs` enforce README coverage and TOC links

## Next Edit

When files are added, update the nearest README and `docs/README.md` all-files block.

## Files To Read

- docs/README.md
- docs/repository/documentation-standards.md

## Files To Touch

- docs/**/README.md

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Acceptance

Every docs directory has one README, resolving links, and recursive descendants listed.

## Must Not

- Do not add placeholder files only to satisfy topology.
