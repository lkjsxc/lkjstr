# Home Feed Slice

## Purpose

Render the first narrow Home Leptos feed rows from real Rust feed view models
without claiming broader feed or Home parity.

## Status

Implemented as a first rendering slice. Home parity remains blocked until real
storage cache proof and relay snapshots feed the Rust model without injection.

## Current Evidence

- Home remains a shipped TypeScript and Svelte surface.
- `crates/lkjstr-app/src/home_feed/**` composes Home follow state, optional
  live query input, shared feed row view models, unavailable rows,
  diagnostics, pending feed loading, and footer states.
- `crates/lkjstr-ui/src/workspace/home.rs` renders event, unavailable,
  diagnostic, profile, notification, and footer rows from `HomeFeedView`.
- A browser WASM test mounts the Rust Home tab with an injected model carrying
  a real event row and cache-hit footer.

## Next Edit

Wire a real host provider that supplies Home feed models from SQLite cache proof
and relay snapshots. Keep parity and deletion ledgers blocked until no-import
proof exists.

## Next Checklist

- [x] Read Home product, followees, Home runtime, feed source, and UI runtime
      contracts.
- [x] Update product or runtime docs only for behavior that is actually
      implemented.
- [x] Add Home query input and view-model tests that consume shared feed rows.
- [x] Add minimal Leptos row rendering for event, unavailable, diagnostic, and
      footer rows.
- [x] Keep TypeScript timeline and tab glue while Svelte remains shipped owner.
- [x] Run app Home, UI Home, timeline reducer, tab-retention, and Rust/WASM
      gates; then record actual verification.

## Acceptance

A narrow Home slice renders real cached rows when coverage proof is complete or
real progressive relay rows when available. Loading, partial, unavailable,
retry, and footer states come from Rust data. Pending provider work after
follows are loaded renders loading, not ready.

## Files To Read

- `docs/product/feeds/home.md`.
- `docs/architecture/runtimes/home-runtime.md`.
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`.
- `crates/lkjstr-app/src/home*` and `crates/lkjstr-ui/src/**home**`.

## Docs To Update First

- Home product or runtime docs only for behavior that is implemented.
- Parity ledger stays `not implemented` until complete proof exists.
- Verification ledger after checks run.

## Files To Touch

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
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- home_feed
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app -- feed
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui -- home
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web -- rust_home_tab
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts
pnpm test -- tests/unit/workspace/tab-retention.test.ts
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final gate before Home parity or deletion claims.

## Commit Boundary

One visible Home slice per commit; no broad deletion in the first slice.

## Must Not

- Do not claim Home implemented.
- Do not delete TypeScript Home runtime.
- Do not render fake feed rows.
