# Author Context Provider Wiring

## Purpose

Replace the Rust Author Context placeholder with real shared-feed rows for
nearby author posts without claiming relay parity or deletion proof.

## Status

Injected-row, cache-backed default-provider, bounded selected-relay relay-read,
row action-opening, exact anchor lookup, and stored author-route slices are
implemented. Browser proof covers explicit unavailable states. TypeScript
Author Context and event-row menu paths remain shipped until no-import and
final verification proof exist.

## Current Evidence

- `crates/lkjstr-app/src/feed/author_context_inputs.rs` builds anchor lookup and
  nearby-author query-demand inputs for the Author Context surface.
- `crates/lkjstr-app/src/author_context_feed/**` builds the first pure Rust
  Author Context feed view and explicit missing-event, missing-author,
  missing-route, and missing-anchor-time states.
- `crates/lkjstr-ui/src/workspace/author_context*.rs` renders a configured
  Author Context tab through a typed provider instead of the pending body.
- `crates/lkjstr-web/src/author_context_host.rs` reads worker-owned SQLite
  anchor and bounded nearby author event rows and marks them partial without
  complete coverage proof.
- `crates/lkjstr-web/src/author_context_relay*.rs` starts a bounded selected-relay
  bootstrap read around the cached anchor timestamp and merges real same-author
  relay events into shared feed rows.
- `crates/lkjstr-web/src/author_context_routes.rs` reads typed stored author
  routes from worker-owned SQLite and feeds them to Rust query demand.
- Exact anchor relay lookup renders a real relay-returned anchor row when no
  cached anchor timestamp exists.
- Browser tab proof renders missing-event, missing-author, no-route, and
  missing-anchor-time states explicitly.
- `crates/lkjstr-ui/src/workspace/author_context*.rs` renders row action buttons
  that open Profile, Thread, and Author Context tabs from real row pubkeys and
  event ids.
- `src/lib/author-context/author-context.ts` is the shipped loader for cached and
  relay-backed nearby author posts.

## Next Edit

Next deletion-readiness work must prove no-import and final verification before
removing TypeScript/Svelte paths. `lkjstr-app` owns the anchor and nearby query
demand; `lkjstr-web` only reads typed route rows, binds browser sockets, and
maps outcomes.

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
- `crates/lkjstr-web/src/author_context_routes.rs`
- `crates/lkjstr-web/src/author_context_relay*.rs`
- `crates/lkjstr-web/tests/author_context_tab_test.rs`
- `crates/lkjstr-web/tests/author_context_provider_test.rs`
- `crates/lkjstr-web/tests/author_context_relay_test.rs`
- `crates/lkjstr-web/tests/author_context_relay_provider_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-app -- author_context
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-ui author_context
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo check -p lkjstr-web --target wasm32-unknown-unknown
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_tab_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_provider_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_relay_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_relay_provider_test
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Acceptance

- Rust Author Context no longer falls through to the pending placeholder body.
- Rows render through the shared `FeedViewModel` and use real `NostrEvent`
  content supplied by the provider or explicit unavailable rows.
- Missing event id, missing author pubkey, and missing route/relay inputs render
  explicit unavailable states.
- The view model exposes anchor and nearby query-demand inputs from Rust data.
- The default browser provider can render cached anchor/nearby rows from
  worker SQLite without claiming complete coverage.
- Bounded relay bootstrap reads use selected read relays, the cached anchor
  timestamp, same-author display-kind filters, owner cleanup, and real relay
  events only.
- If the anchor is not cached, exact relay lookup uses real selected or stored
  author-route relays, an ids+author filter, and the returned event timestamp.
- Stored author routes are read from worker-owned SQLite and passed into Rust
  query demand without making route policy decisions in `lkjstr-web`.
- Rust row action buttons can open Thread and Author Context tabs from real
  event row ids and pubkeys.
- TypeScript Author Context and Svelte tab paths remain until no-import and
  final gates prove deletion readiness.

## Must Not

- Do not synthesize author posts, anchor events, profiles, or successful reads.
- Do not treat cache misses or missing relay answers as absence.
- Do not delete `src/lib/author-context`, `src/lib/tabs/author-context`, or
  event row menu glue.
