# Post Display Reliability

## Purpose

Repair screenshot-class states where real posts should display when cache or
relay evidence exists, and unavailable states should stay precise when evidence
is missing.

## Status

Current Home and relay-socket slice implemented. Typed read availability covers
the Home and Notifications case where a real page active pubkey exists and relay
settings storage is unavailable. Shared feed runtime parity and the remaining
post-display surfaces remain open.

## Current Evidence

- Home and Notifications read plans can use diagnosed read-only session default
  public relays when relay settings are unavailable.
- Focused Rust tests cover durable-empty, allowed fallback, forbidden fallback,
  and Home/Notifications loading instead of `no-enabled-relay`.
- Focused TypeScript tests cover workspace page data preserving the active
  account while relay settings are unavailable.

## Current Acceptance Evidence

- `home_feed_cache_tests` proves unavailable latest kind `3` cache lookup stays
  diagnostic and returns the follow-loading signal.
- `home_feed_relay_input_tests` proves follow-loading plans relay follow reads,
  and loaded follows plan note reads for the active account and real follows.
- `relay_host_socket_test` proves Rust/WASM sockets do not wire-send unless
  `OPEN` and detach `CONNECTING` sockets on app-owned close.
- `relay-client-closing-socket.test.ts` proves retained TypeScript relay clients
  detach `CONNECTING` sockets without app-close.
- `home_feed_relay_provider_test` uses synthetic relay protocol frames to prove
  cache-unavailable Home can render a real relay note with the diagnostic.

## Next Edit

Expand the degraded-storage relay-display matrix across Notifications, Profile,
Thread, Search, Global, Followees, User Timeline, Author Context, and Custom
Request without claiming parity until each surface has focused evidence.

## Screenshot Reproduction Inputs

- protected account storage unavailable or selector unavailable.
- page shell supplies a real active pubkey.
- durable relay settings storage unavailable.
- surface policy allows read-only session default public relays.
- cache is empty or unavailable without absence proof.
- relay snapshots may later report partial or failed attempts.

Expected result: Home, Notifications, Profile, Global, and targeted feed tabs
are loading, partial, or diagnostic with a real session-default read plan when
policy allows it. They do not show `no-enabled-relay`, `no-active-account`, or
empty copy solely because durable storage is unavailable.

## Degraded-Storage Matrix

| Surface | Real fact that keeps reads alive | Disallowed replacement state |
| --- | --- | --- |
| Home | page active pubkey plus real follow proof or kind `3` discovery | `no-enabled-relay` or empty feed from storage failure |
| Notifications | page active pubkey | `no-active-account`, `no-enabled-relay`, or empty notifications without exhaustion proof |
| Profile | route profile pubkey | header unavailable blocking note rows |
| Thread | route event id or pointer | empty thread from missing cache or failed relay |
| Search | submitted query | fake search success or empty from local-index failure |
| Global | allowed public read plan | empty global feed from relay settings failure |
| Followees | target pubkey | `0 following` before real kind `3` proof |
| User Timeline | target pubkey | empty target timeline from missing follow-list cache |
| Author Context | anchor event id or author pubkey | hidden context rows from missing anchor cache |
| Custom Request | explicit user filters | success rows not backed by relay or cache events |
| Public Chat | channel id or channel-list request | placeholder channel messages |

## Files To Read

- [../../architecture/network/read-availability/README.md](../../architecture/network/read-availability/README.md).
- [../../product/feeds/post-display.md](../../product/feeds/post-display.md).
- [../blockers/shared-feed-runtime.md](../blockers/shared-feed-runtime.md).

## Files To Touch

- `crates/lkjstr-web/src/home_feed_cache.rs`.
- `crates/lkjstr-web/src/home_feed_relay_input.rs`.
- `crates/lkjstr-web/src/relay_host/socket.rs` and Rust read close helpers.
- `src/lib/relays/relay-client.ts`.
- Focused Rust and TypeScript tests for Home discovery, socket cancellation,
  and degraded-state post display.

## Focused Gate

```sh
cargo test -p lkjstr-app --test read_availability_test
cargo test -p lkjstr-app --test read_availability_feed_test
cargo test -p lkjstr-app --test protected_account_states_test
cargo test -p lkjstr-web --test relay_host_socket_test
cargo test -p lkjstr-web --test home_feed_relay_provider_test
pnpm test tests/unit/workspace/workspace-page-data.test.ts tests/unit/relays/read-availability.test.ts tests/unit/relays/relay-client-closing-socket.test.ts
```

## Acceptance

- `no-enabled-relay` is reserved for durable settings loaded with no enabled
  read relays or policy-forbidden fallback.
- Cached follow-list storage failure is incomplete evidence, not absence proof;
  Home keeps relay follow discovery alive when read relays are allowed.
- Public and allowed protected read-only surfaces can use real session default
  public relays with diagnostics.
- Writes require durable signer and enabled write-relay evidence.
- Long posts, repost targets, and notification source events keep using shared
  post display contracts.

## Must Not

- Do not synthesize posts, profiles, counters, relay success, or write success.
- Do not treat a cache miss, relay failure, or storage failure as absence proof.
- Do not delete retained TypeScript or Svelte product paths from this task.
