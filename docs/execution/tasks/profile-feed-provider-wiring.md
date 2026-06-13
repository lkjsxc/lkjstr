# Profile Feed Provider Wiring

## Purpose

Supply the Rust Profile feed view model from protected SQLite coverage and
bounded relay reads without claiming Profile or Author Context deletion proof.

## Status

Implemented enabling slice. TypeScript Profile remains the shipped owner until
no-import proof and final verification exist.

## Current Evidence

- `crates/lkjstr-app/src/profile_feed/**` builds author note queries, explicit
  missing-pubkey and missing-relay rows, partial coverage rows, and shared footer
  states.
- `crates/lkjstr-ui/src/workspace/profile.rs` renders real event rows from an
  injected `ProfileFeedView`.
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs` proves the Rust browser tab
  can open My Profile and render injected real note content.
- `crates/lkjstr-web/tests/profile_feed_provider_test.rs` proves the default
  host provider renders SQLite-authored note rows from exact Profile route
  coverage, keeps incomplete coverage partial, and excludes metadata and
  follow-list rows from visible note slots.
- `crates/lkjstr-web/tests/profile_feed_header_test.rs` proves cached kind `0`
  header metadata and cached kind `3` follow counts render in the Rust Profile
  tab without turning unknown follow-list state into `0 following`.
- `crates/lkjstr-web/tests/profile_feed_header_relay_test.rs` proves separate
  relay metadata and follow-list header demand, storage, and rebuild paths.
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs` proves known following
  count clicks open Followees, Profile header actions open User Timeline for the
  viewed pubkey, and own-profile actions open Profile Edit.
- `crates/lkjstr-web/tests/profile_copy_tab_test.rs` proves the Rust Profile
  copy menu sends npub, nprofile, follow-list JSON, and relay-set JSON values
  through the host copy provider before showing copied status.
- `crates/lkjstr-web/tests/profile_follow_tab_test.rs` proves the Rust Profile
  follow button loads cached provider state, toggles through the provider,
  preserves state when publishing fails, and stores local or NIP-07 kind `3`
  follow events only after relay OK.
- `crates/lkjstr-web/tests/profile_feed_cleanup_test.rs` proves owner cleanup
  suppresses late Profile provider completions after tab switch.

## Next Edit

Continue to Profile and Author Context deletion proof. Do not delete TypeScript
Profile or Author Context paths until the no-import and final gates pass.

## Next Checklist

- [x] Read Profile product, runtime, route, and feed-source contracts.
- [x] Keep metadata and follow-list events outside visible note page slots.
- [x] Promote cache-ready only from exact Profile route/filter/interval proof.
- [x] Keep partial cache proof visible and start bounded relay reads.
- [x] Render cached kind `0` metadata and kind `3` follow-count state.
- [x] Refresh header metadata/follow-list state from relay-discovered events.
- [x] Open Followees from the known following-count action.
- [x] Open User Timeline from the Profile header action.
- [x] Open Profile Edit from the own-profile action.
- [x] Copy npub, nprofile, follow-list JSON, and relay-set JSON through the
      host-backed Profile copy menu.
- [x] Show non-own Profile Follow/Unfollow from cached provider state without
      fake publish success.
- [x] Publish non-own Profile Follow/Unfollow through local or NIP-07 signing
      only after enabled write relays accept the kind `3` event.
- [x] Prove owner cleanup suppresses late provider completions and relay output.
- [x] Keep TypeScript Profile and Author Context paths until parity, no-import,
      and deletion proof exist.

## Acceptance

The default Rust Profile tab can render real cached authored note rows from
SQLite coverage proof and can keep incomplete coverage partial while starting
bounded relay work. Cached Profile header metadata and follow-count states
render without fake zero counts, refresh from relay events stored in worker
SQLite, copy npub/nprofile/follow-list/relay-set JSON through the host provider,
open Followees/User Timeline/Profile Edit action tabs, and show or locally
or NIP-07 publish Follow/Unfollow without fake success. Empty Profile notes are
shown only after complete proof.

## Files To Read

- `docs/product/feeds/profiles.md`.
- `docs/architecture/runtimes/profile-runtime.md`.
- `docs/architecture/feeds/sources/profile.md`.
- `docs/architecture/network/subscription-orchestration/routing-by-surface.md`.
- `crates/lkjstr-web/src/home_feed_*.rs` and `global_feed_*.rs` provider
  patterns.

## Files To Touch

- `crates/lkjstr-web/src/profile_feed_*.rs`.
- `crates/lkjstr-ui/src/workspace/profile_provider.rs`.
- `crates/lkjstr-app/src/profile_feed/**` only for provider-shaped model gaps.
- Focused Profile provider browser tests.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/profile/**`, `src/lib/author-context/**`, and Profile tab glue
until Rust host providers and deletion proof exist.

## Focused Gate

```sh
cargo test -p lkjstr-app --test profile_feed_test
cargo test -p lkjstr-app --test profile_header_test
cargo test -p lkjstr-ui profile
cargo check -p lkjstr-web --target wasm32-unknown-unknown
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_header_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_header_relay_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_tab_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_follow_tab_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_cleanup_test
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final verification before any Profile parity or deletion
claim.

## Must Not

- Do not synthesize profile, relay, cache, follow-list, or event rows.
- Do not treat missing coverage or an empty cache as absence.
- Do not delete TypeScript or Svelte Profile paths.
