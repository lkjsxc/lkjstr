# Profile Sparse History Proof

## Purpose

Prevent Rust Profile tabs from showing an empty-notes success state after only a
recent empty window. A Profile may render empty only after sparse historical
coverage proves absence for the attempted routes down to the configured floor.

## Status

Implemented enabling proof. Profile provider cache and relay wiring now keep
empty recent coverage in a searching older state until sparse historical proof
allows the terminal empty footer.

## Current Evidence

- `crates/lkjstr-app/src/profile_history.rs` has the pure sparse scan planner.
- `crates/lkjstr-web/src/profile_feed_coverage.rs` proves exact Profile route
  coverage for one bounded interval.
- `crates/lkjstr-web/src/profile_feed_host.rs` can start a bounded Profile
  relay read after partial cache proof.
- `crates/lkjstr-web/src/profile_feed_sparse.rs` walks exact empty coverage
  backward and selects the next older interval or `EmptyProven`.
- Browser tests prove recent empty coverage is not terminal empty and full empty
  coverage renders `No rows`.

## Next Edit

Next queue is remaining Profile actions and deletion proof. Do not delete
TypeScript or Svelte Profile paths from this task.

## Files To Read

- `docs/architecture/runtimes/profile-runtime.md`.
- `docs/architecture/data/feed-coverage.md`.
- `docs/architecture/data/cache-first-feed-pages.md`.
- `crates/lkjstr-app/src/profile_history.rs`.
- `crates/lkjstr-web/src/profile_feed_coverage.rs`.
- `crates/lkjstr-web/src/profile_feed_host.rs`.

## Files To Touch

- `crates/lkjstr-app/src/profile_feed/**`.
- `crates/lkjstr-web/src/profile_feed_*.rs`.
- `crates/lkjstr-app/tests/profile_feed_test.rs`.
- `crates/lkjstr-web/tests/profile_feed_provider_test.rs`.
- Matching execution, runtime, and cutover ledger docs.

## Focused Gate

```sh
cargo test -p lkjstr-app --test profile_history_test --test profile_feed_test
cargo check -p lkjstr-web --target wasm32-unknown-unknown
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_provider_test
pnpm rust-wasm:quiet
```

## Acceptance

- A complete recent empty Profile window renders searching/partial history, not
  terminal empty.
- A contiguous exact empty coverage chain down to the sparse floor renders the
  terminal empty footer.
- The relay read uses the planned older sparse interval instead of the recent
  live interval.
- Dense, incomplete, missing, or non-empty coverage does not prove absence.

## Must Not

- Do not show `No rows` from a local cache miss or a single recent complete
  empty window.
- Do not mix metadata or follow-list rows into Profile note slots.
- Do not delete TypeScript or Svelte Profile paths.
