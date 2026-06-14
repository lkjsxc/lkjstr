# Home Feed Provider Wiring

## Purpose

Supply the Rust Home feed view model from real SQLite cache proof and relay
snapshots instead of an injected test model.

## Status

Implemented enabling proof. Cache-backed default provider wiring, exact
coverage proof, bounded relay snapshot updates, and Rust Home owner cleanup are
implemented. Followees and User Timeline request-level lease guards now match
the Home-style `request.is_released()` API. Broader shared lease parity and
deletion proof remain open.

## Current Evidence

- `crates/lkjstr-app/src/home_feed/**` builds Home feed view models and query
  inputs from explicit follow, source, and window states.
- `crates/lkjstr-ui/src/workspace/home.rs` renders the view model.
- `crates/lkjstr-web/tests/home_feed_tab_test.rs` proves browser rendering with
  an injected real event row.
- `crates/lkjstr-web/tests/home_feed_provider_test.rs` proves the default Rust
  shell renders a real cached event row through the host provider. It also
  proves the tab stays partial without exact coverage and reaches ready only
  when feed id, route group, relay, filter, and interval coverage match.
- `crates/lkjstr-web/src/home_feed_relay*.rs` starts a bounded selected-relay
  Home read after partial cache proof, publishes real relay event snapshots into
  the same `HomeFeedView`, and leaves no-event terminal failures partial.
- `crates/lkjstr-web/tests/home_feed_startup_test.rs` proves startup with an
  unavailable storage worker still mounts Welcome and renders explicit Home
  account and relay diagnostics.
- `crates/lkjstr-ui/src/workspace/home_provider.rs` and
  `crates/lkjstr-ui/src/workspace/home.rs` release the Home provider lease on
  tab cleanup and suppress late completions after release.
- `crates/lkjstr-web/src/home_feed_relay_read_tail.rs` keeps an owner-keyed
  weak read registry so provider release cancels the owner read and closes
  relay sockets and timers.
- `crates/lkjstr-app/tests/home_feed_relay_test.rs` proves relay-progressive
  Home snapshots render real rows with the reading-relays footer.
- `crates/lkjstr-ui/tests/followees_provider_test.rs` and
  `user_timeline_provider_test.rs` prove released request objects report
  `is_released()` and suppress late completions.
- `crates/lkjstr-web/src/followees_host.rs` and `user_timeline_host.rs` use
  request-level release guards before host loads, after host loads, and before
  relay callback completion.

## Next Edit

Continue shared lease cleanup proof for remaining feed surfaces and older-load
paths without deleting TypeScript or Svelte owners.

## Next Checklist

- [x] Read Home runtime, feed coverage, cache-first pages, relay host runner,
      and UI runtime contracts.
- [x] Update feed runtime docs before changing provider semantics.
- [x] Keep missing coverage as partial or loading, never absence proof.
- [x] Feed real cached rows into `HomeFeedView` from protected SQLite event
      repositories without claiming missing coverage as absence.
- [x] Promote cache-complete only from exact feed, route, relay, filter, and
      interval coverage proof.
- [x] Feed real progressive relay snapshots into `HomeFeedView` when relays
      answer.
- [x] Release the Rust Home owner read on tab cleanup and suppress late
      completions after release.
- [x] Prove storage-failure startup keeps Welcome usable and Home diagnostics
      explicit.
- [x] Keep TypeScript Home runtime and tab glue until deletion proof exists.
- [x] Run Home app, UI, browser, timeline, tab-retention, and Rust/WASM gates.

## Acceptance

The default Rust Home tab receives a `HomeFeedView` from real host evidence.
Complete cache proof can render cached rows; progressive relay snapshots can
render relay rows; partial and unavailable states remain explicit.

## Files To Read

- `docs/architecture/runtimes/home-runtime.md`.
- `docs/architecture/data/cache-first-feed-pages.md`.
- `docs/architecture/data/feed-coverage.md`.
- `docs/architecture/rust-wasm/cutover/relay-wiring.md`.
- `crates/lkjstr-app/src/home_feed/**`.
- `crates/lkjstr-ui/src/workspace/home.rs`.
- `crates/lkjstr-web/src/**`.

## Files To Touch

- `crates/lkjstr-web` Home host provider glue.
- `crates/lkjstr-ui` provider threading if needed.
- `crates/lkjstr-app` only for pure model gaps found during wiring.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/timeline/**`, `src/lib/tabs/timeline/**`, and feed-surface
TypeScript until Home parity and no-import proof exist.

## Focused Gate

```sh
cargo test -p lkjstr-app -- home_feed
cargo test -p lkjstr-ui -- home
wasm-pack test --headless --chrome crates/lkjstr-web -- rust_home_tab
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts
pnpm test -- tests/unit/workspace/tab-retention.test.ts
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final gate before any Home parity or deletion claim.

## Must Not

- Do not synthesize relay, cache, follow-list, profile, or event rows.
- Do not treat cache miss or incomplete coverage as absence.
- Do not delete TypeScript or Svelte Home paths.
