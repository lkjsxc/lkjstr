# Post Display Reliability

## Purpose

Repair screenshot-class states where real posts should display when cache or
relay evidence exists, and unavailable states should stay precise when evidence
is missing.

## Status

Partial. Typed read availability now covers the Home and Notifications case
where a real page active pubkey exists and relay settings storage is
unavailable. Broader post-display parity remains in the shared feed runtime
blocker.

## Current Evidence

- Home and Notifications read plans can use diagnosed read-only session default
  public relays when relay settings are unavailable.
- Focused Rust tests cover durable-empty, allowed fallback, forbidden fallback,
  and Home/Notifications loading instead of `no-enabled-relay`.
- Focused TypeScript tests cover workspace page data preserving the active
  account while relay settings are unavailable.

## Next Edit

Continue through the shared feed runtime blocker: expand the effective read plan
to any remaining host-provider entry points and keep post display on shared rows
for repost targets, notification source events, and long content.

## Screenshot Reproduction Inputs

- protected account storage unavailable or selector unavailable.
- page shell supplies a real active pubkey.
- durable relay settings storage unavailable.
- surface policy allows read-only session default public relays.
- cache is empty or unavailable without absence proof.
- relay snapshots may later report partial or failed attempts.

Expected result: Home and Notifications are loading, partial, or diagnostic with
a real session-default read plan. They do not show `no-enabled-relay` solely
because durable relay settings are unavailable.

## Files To Read

- [../../architecture/network/read-availability/README.md](../../architecture/network/read-availability/README.md).
- [../../product/feeds/post-display.md](../../product/feeds/post-display.md).
- [../blockers/shared-feed-runtime.md](../blockers/shared-feed-runtime.md).

## Files To Touch

- `crates/lkjstr-app/src/read_availability.rs`.
- `crates/lkjstr-web/src/effective_public_relays.rs`.
- `crates/lkjstr-web/src/home_feed_host*` and `notifications_feed_host*`.
- `src/lib/relays/read-availability.ts` and workspace page-data tests.

## Focused Gate

```sh
cargo test -p lkjstr-app --test read_availability_test
cargo test -p lkjstr-app --test read_availability_feed_test
cargo test -p lkjstr-app --test protected_account_states_test
pnpm test tests/unit/workspace/workspace-page-data.test.ts tests/unit/relays/read-availability.test.ts
```

## Acceptance

- `no-enabled-relay` is reserved for durable settings loaded with no enabled
  read relays or policy-forbidden fallback.
- Public and allowed protected read-only surfaces can use real session default
  public relays with diagnostics.
- Writes require durable signer and enabled write-relay evidence.
- Long posts, repost targets, and notification source events keep using shared
  post display contracts.

## Must Not

- Do not synthesize posts, profiles, counters, relay success, or write success.
- Do not treat a cache miss, relay failure, or storage failure as absence proof.
- Do not delete retained TypeScript or Svelte product paths from this task.
