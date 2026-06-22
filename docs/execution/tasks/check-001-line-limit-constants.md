# CHECK-001 Line-Limit Checker Constants

## Purpose

Keep TypeScript and Rust line-limit checkers explicit and drift-resistant.

## Status

implemented

## Current Evidence

- commit `d549a453` introduced named line-limit constants in both checkers

## Next Edit

Update both constants and the line-limit contract in the same change if the cap changes.

## Files To Read

- docs/repository/line-limits.md
- scripts/check-repo.ts
- crates/lkjstr-xtask/src/line_check.rs

## Files To Touch

- scripts/check-repo.ts
- crates/lkjstr-xtask/src/line_check.rs
- docs/repository/line-limits.md

## Focused Gate

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

## Acceptance

Checker constants and docs state the same caps.

## Must Not

- Do not use magic cap literals in new checker code.
