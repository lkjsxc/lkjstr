# STATS-001 Diagnostics Integration

## Purpose

Merge real storage, relay, optimizer, geometry, job, memory, and log diagnostics into Stats.

## Status

ready

## Current Evidence

- Stats has partial Rust storage and geometry diagnostics
- relay/job/memory merge remains open

## Next Edit

Pick one missing diagnostics source and render real rows with exact unavailable reasons.

## Files To Read

- docs/agent/skills/stats-diagnostics.md
- docs/product/tools/stats.md
- docs/architecture/orchestration/stats.md

## Files To Touch

- crates/lkjstr-storage/\*\*
- crates/lkjstr-ui/src/workspace/stats\*
- crates/lkjstr-web/\*\*
- src/lib/tabs/stats/\*\*

## Focused Gate

```sh
pnpm test -- tests/unit/log tests/unit/storage tests/unit/relays
cargo test -p lkjstr-storage stats
pnpm verify:quiet
```

## Acceptance

Stats has no placeholder counters or indefinite loading for the edited source.

## Must Not

- Do not hide unavailable reasons.
- Do not expose secrets in diagnostics.
