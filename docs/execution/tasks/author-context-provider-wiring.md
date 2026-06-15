# Author Context Provider Wiring

## Purpose

Replace the Rust Author Context placeholder with real shared-feed rows for
nearby author posts without claiming relay parity or deletion proof.

## Status

Injected-row, cache-backed default-provider, bounded selected-relay relay-read,
row action-opening, exact anchor lookup, and stored author-route slices are
implemented. Browser proof covers explicit unavailable states and the shipped
Svelte tab now mounts the Rust body as a WASM island. The unused TypeScript
Author Context loader and its deletion-anchor directory were removed after
no-import proof. Row-level `EventMoreMenu.svelte` imports are removed, while
the retained event menu file and generic Svelte host paths remain until
component deletion proof and final verification exist.

## Current Evidence

- `crates/lkjstr-app/src/feed/author_context_inputs.rs` builds anchor lookup and
  nearby-author query-demand inputs for the Author Context surface.
- `crates/lkjstr-app/src/author_context_feed/**` builds the first pure Rust
  Author Context feed view and explicit missing-event, missing-author,
  missing-route, missing-anchor-time, and pending-loading states.
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
- `crates/lkjstr-ui/src/workspace/feed_event_actions.rs` shares the Rust
  Profile, Thread, and Author Context row action renderer with User Timeline.
- Rust feed event actions expose host-backed event-id copy through the existing
  browser clipboard provider without calling browser APIs from `lkjstr-ui`, and
  keep success/failure status text compatible with the retained Svelte menu.
- Rust feed event actions render behind an accessible Rust-owned event menu shell.
  The menu shell is suppressed when no real action provider exists.
- Focused UI tests prove copy-only event menus and converted Author
  Context/User Timeline action providers keep the Rust menu available only from
  real providers.
- The retained Svelte `EventMoreMenu` reports clipboard unavailable or rejected
  writes explicitly instead of claiming copied status.
- `crates/lkjstr-ui/src/workspace/feed_event_row.rs` shares event body rendering
  plus real author-pubkey metadata fallback and sensitive-content warning
  reason/reveal rows; media and reference fragments render explicit unavailable
  preview text until real preview data is present.
- `crates/lkjstr-ui/src/workspace/feed_state_row.rs` shares unavailable,
  diagnostic, profile, notification, and plain continuation state rows.
- `crates/lkjstr-ui/src/workspace/feed_footer_row.rs` and
  `feed_footer_text.rs` share footer shell rendering while preserving
  surface-specific auth copy.
- Focused `lkjstr-ui` unit tests cover shared event-fragment text extraction
  plus shared state-row and footer presentation data without browser-only proof.
- `src/lib/components/workspace/RustIslandHost.svelte` and
  `author-context-island.ts` mount the Rust body through the WASM asset loader
  and forward required workspace action callbacks instead of dummy no-op row
  actions.
- Fast `lkjstr-ui` provider tests prove Author Context lease cleanup runs once,
  released requests expose `is_released()`, and late completions are suppressed.
- The retired `src/lib/author-context` helper directory has no product imports
  and is removed in the loader deletion slice.

## Next Edit

Prove the remaining Author Context deletion blockers: retained event menu file
deletion readiness and final verification. Keep the generic Svelte host glue
and retained event menu file until shared Leptos event renderer parity, host
no-import proof, component deletion proof, and final verification exist.
`lkjstr-app` owns the anchor and nearby query demand; `lkjstr-web` only reads
typed route rows, binds browser sockets, and maps outcomes.

## Files To Read

- `docs/product/tools/author-context.md`
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
- `docs/architecture/rust-wasm/cutover/ui-surface-map.md`
- `src/lib/components/workspace/RustIslandHost.svelte`
- `src/lib/components/workspace/author-context-island.ts`
- `crates/lkjstr-app/src/feed/author_context_inputs.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`

## Files To Touch

- `crates/lkjstr-app/src/author_context_feed/**`
- `crates/lkjstr-app/src/lib.rs`
- `crates/lkjstr-ui/src/workspace/author_context*.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`
- `crates/lkjstr-web/src/author_context_island.rs`
- `src/lib/components/workspace/RustIslandHost.svelte`
- `src/lib/components/workspace/author-context-island.ts`
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
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver crates/lkjstr-web --test author_context_island_test
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Acceptance

- Rust Author Context no longer falls through to the pending placeholder body.
- Rows render through the shared `FeedViewModel` and use real `NostrEvent`
  content supplied by the provider or explicit unavailable rows.
- Missing event id, missing author pubkey, and missing route/relay inputs render
  explicit unavailable states.
- The view model exposes anchor and nearby query-demand inputs from Rust data.
- Pending provider work renders loading until cached rows, progressive relay
  rows, or terminal relay evidence exists.
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
- Rust Author Context and User Timeline rows share the same Leptos event action
  renderer while retaining surface-specific labels and test ids.
- Rust Author Context rows expose event-id copy through a host-provided
  clipboard action; copy success and failure render explicit status strings
  matching the retained Svelte event menu.
- Rust Author Context rows render those actions inside a Rust-owned event menu
  shell instead of exposing only loose buttons, and empty action menus are not
  rendered.
- Rust Author Context rows use the shared event body and author metadata
  renderer, with actions still attached from real row ids and pubkeys.
- Rust Author Context rows with content-warning tags render explicit sensitive
  state, real NIP-36 reason text, and local reveal controls before note text is
  shown.
- Rust Author Context media/reference fragments receive app-owned explicit
  unavailable preview rows instead of synthetic preview content.
- Rust Author Context uses shared feed state-row rendering for explicit
  unavailable, diagnostic, profile, notification, and plain continuation rows.
- Rust Author Context uses shared feed footer shell rendering while preserving the
  existing `Auth required` copy.
- The shipped Svelte Author Context tab can mount and unmount the Rust body
  without leaking a provider lease, and row actions call required Svelte
  workspace callbacks rather than no-op fallbacks.
- The Svelte host cancels pending WASM mounts when hidden or destroyed, so late
  bridge loads unmount their returned handle instead of remounting a hidden
  island.
- The Author Context provider request exposes `is_released()` so host adapters
  can guard late async completions at the typed request boundary.
- The unused TypeScript loader and deletion-anchor directory remain removed
  after no-import proof.
- Row-level `EventMoreMenu.svelte` imports are removed; generic Svelte host glue
  and the retained event menu file remain until component deletion proof and
  final gates prove deletion readiness.

## Must Not

- Do not synthesize author posts, anchor events, profiles, or successful reads.
- Do not treat cache misses or missing relay answers as absence.
- Do not delete generic host glue or the retained event menu file before
  component deletion proof and final gates.
