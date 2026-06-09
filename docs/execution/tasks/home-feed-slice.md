# Home Feed Slice

## Purpose

Render the first narrow Home Leptos feed rows from real Rust feed view models
without claiming broader feed or Home parity.

## Current Evidence

- Home remains a shipped TypeScript and Svelte surface.
- Rust query inputs, feed reducers, cache display policy, and geometry pieces
  exist but are not one product Home runtime yet.

## Target Behavior

A narrow Home slice renders real cached rows when coverage proof is complete or
real progressive relay rows when available. Loading, partial, unavailable,
retry, and footer states come from Rust data.

## Files To Read

- `docs/product/feeds/home.md`.
- `docs/architecture/runtimes/home-runtime.md`.
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`.
- `crates/lkjstr-app/src/home*` and `crates/lkjstr-ui/src/**home**`.

## Docs To Update First

- Home product or runtime docs only for behavior that is implemented.
- Parity ledger stays `not implemented` until complete proof exists.
- Verification ledger after checks run.

## Rust Files To Touch

- `crates/lkjstr-app` Home/feed view-model modules.
- `crates/lkjstr-ui` Home feed rows.
- `crates/lkjstr-web` only for host adapter glue.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/timeline/**`, Home tab glue, and feed-surface TypeScript until
Home parity and deletion proof exist.

## Tests To Add Or Update

- Rust Home view-model tests.
- Leptos row rendering tests.
- Existing timeline and tab-retention regression tests while Svelte remains.

## Focused Gate

```sh
cargo test -p lkjstr-app -- home
cargo test -p lkjstr-ui -- home
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts
```

## Final Gate

Run Docker Compose final gate before Home parity or deletion claims.

## Commit Boundary

One visible Home slice per commit; no broad deletion in the first slice.

## Must Not

- Do not claim Home implemented.
- Do not delete TypeScript Home runtime.
- Do not render fake feed rows.
