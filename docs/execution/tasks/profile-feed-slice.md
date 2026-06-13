# Profile Feed Slice

## Purpose

Render a first Rust Profile note list from the shared feed view model without
claiming storage-backed Profile parity.

## Status

Implemented narrow enabling slice. TypeScript Profile runtime remains shipped
owner.

## Current Evidence

- `profile_live_query_input` builds a profile-authored notes demand.
- The shared row view model renders real event rows and explicit state rows.
- Profile sparse-history and follow-count reducers exist, but are not wired into
  a Rust Profile host provider.

## Next Edit

Use [profile-feed-provider-wiring.md](profile-feed-provider-wiring.md) for
storage-backed Profile provider work.

## Next Checklist

- [x] Read Profile runtime and feed source contracts.
- [x] Keep metadata and follow-list events out of note page slots.
- [x] Add pure Profile feed model tests for author query, missing pubkey,
      missing relay, and partial coverage states.
- [x] Add first Leptos Profile rendering proof from a real event row.
- [x] Keep TypeScript Profile and Author Context paths until host provider,
      parity, no-import, and deletion proof exist.
- [x] Run focused app, UI, browser, repo, docs, and Rust/WASM gates.

## Acceptance

The Rust Profile tab can render a `ProfileFeedView` containing real authored
note rows. Missing pubkey, missing relays, and partial coverage remain explicit;
no empty state is shown without complete proof.

## Files To Read

- `docs/architecture/runtimes/profile-runtime.md`.
- `docs/architecture/feeds/sources/profile.md`.
- `docs/product/feeds/profiles.md`.
- `crates/lkjstr-app/src/feed/**`.
- `crates/lkjstr-ui/src/workspace/**`.

## Files To Touch

- `crates/lkjstr-app/src/profile_feed/**`.
- `crates/lkjstr-ui/src/workspace/profile.rs`.
- Narrow WASM test export and browser test paths.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/profile/**`, `src/lib/author-context/**`, and Profile tab glue
until Rust host providers and deletion proof exist.

## Focused Gate

```sh
cargo test -p lkjstr-app --test profile_feed_test
cargo test -p lkjstr-ui profile
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_tab_test
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final verification before any Profile parity or deletion
claim.

## Must Not

- Do not synthesize profile, relay, cache, follow-list, or event rows.
- Do not treat missing coverage or an empty cache as absence.
- Do not delete TypeScript or Svelte Profile paths.
