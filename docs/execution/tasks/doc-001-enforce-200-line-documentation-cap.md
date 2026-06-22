# DOC-001 Enforce 200-Line Documentation Cap

## Purpose

Align repository contracts and checkers with the strict 200-line documentation cap.

## Status

implemented

## Current Evidence

- commit `633dfcbe` lowered TypeScript and Rust checker caps
- all strict docs pass line checks

## Next Edit

Preserve the cap when documentation contracts move.

## Files To Read

- AGENTS.md
- docs/repository/line-limits.md
- docs/repository/documentation-standards.md

## Files To Touch

- scripts/check-repo.ts
- crates/lkjstr-xtask/src/line_check.rs
- strict docs over the cap

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Acceptance

All strict docs and source files remain at or below 200 lines.

## Must Not

- Do not raise the cap.
- Do not move docs into ignored paths.
