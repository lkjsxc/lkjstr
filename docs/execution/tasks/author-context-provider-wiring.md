# Author Context Provider Wiring

## Purpose

Replace the Rust Author Context placeholder with real shared-feed rows for
nearby author posts without claiming cache/relay parity or deletion proof.

## Status

First injected-row slice implemented. TypeScript Author Context and event-row
menu paths remain the shipped owner until Rust cache, relay, action-opening,
no-import, and final verification proof exist.

## Current Evidence

- `crates/lkjstr-app/src/feed/author_context_inputs.rs` builds anchor lookup and
  nearby-author query-demand inputs for the Author Context surface.
- `crates/lkjstr-app/src/author_context_feed/**` builds the first pure Rust
  Author Context feed view and explicit missing-event, missing-author,
  missing-route, and missing-anchor-time states.
- `crates/lkjstr-ui/src/workspace/author_context*.rs` renders a configured
  Author Context tab through a typed provider instead of the pending body.
- `crates/lkjstr-web/src/author_context_host.rs` returns honest default
  unavailable state until cache and relay host reads are wired.
- `src/lib/author-context/author-context.ts` is the shipped loader for cached and
  relay-backed nearby author posts.

## Next Edit

Wire cache and relay host reads plus action-opening parity. Do not delete
TypeScript or Svelte Author Context paths until no-import and final proof exist.

## Files To Read

- `docs/product/tools/author-context.md`
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
- `docs/architecture/rust-wasm/cutover/ui-surface-map.md`
- `src/lib/author-context/author-context.ts`
- `src/lib/tabs/author-context/AuthorContextTab.svelte`
- `crates/lkjstr-app/src/feed/author_context_inputs.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`

## Files To Touch

- `crates/lkjstr-app/src/author_context_feed/**`
- `crates/lkjstr-app/src/lib.rs`
- `crates/lkjstr-ui/src/workspace/author_context*.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`
- `crates/lkjstr-web/tests/author_context_tab_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-app -- author_context
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-ui author_context
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo check -p lkjstr-web --target wasm32-unknown-unknown
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_tab_test
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Acceptance

- Rust Author Context no longer falls through to the pending placeholder body.
- Rows render through the shared `FeedViewModel` and use real `NostrEvent`
  content supplied by the provider or explicit unavailable rows.
- Missing event id, missing author pubkey, and missing route/relay inputs render
  explicit unavailable states.
- The view model exposes anchor and nearby query-demand inputs from Rust data.
- TypeScript Author Context and Svelte tab paths remain until cache, relay,
  action-opening, no-import, and final gates prove deletion readiness.

## Must Not

- Do not synthesize author posts, anchor events, profiles, or successful reads.
- Do not treat cache misses or missing relay answers as absence.
- Do not delete `src/lib/author-context`, `src/lib/tabs/author-context`, or
  event row menu glue.
