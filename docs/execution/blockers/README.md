# Execution Blockers

## Purpose

This subtree preserves the detailed blocker contracts that were split out of
[../current-blockers.md](../current-blockers.md).

## Table of Contents

- [storage-command-coverage.md](storage-command-coverage.md): storage command coverage proof.
- [relay-effect-runner.md](relay-effect-runner.md): relay host runner proof.
- [shared-feed-runtime.md](shared-feed-runtime.md): current shared feed runtime blocker.
- [home-leptos-feed.md](home-leptos-feed.md): first Home Leptos feed blocker.
- [deletion-proof.md](deletion-proof.md): deletion proof blocker.

## Dependency Order

Storage wiring enables relay proof. The storage command-coverage and relay
host-runner enabling slices are implemented; storage and relay parity plus
deletion remain blocked. Shared feed runtime is the current first incomplete
blocker and has pure row-view-model, first Home rendering, cache-backed
provider, exact Home coverage proof, bounded Home relay snapshot wiring, Rust
Home owner-release cleanup, Home one-scroll-owner row-flow proof, first Global
rendering, Global cache-backed
provider proof, Global browser cleanup proof, Global footer/scroll and
viewport-fill older request proof, first Notifications cached
provider proof, Notifications browser cleanup proof, Notifications bounded
older relay-window plus footer and scroll-triggered older proof, and first
Profile storage-backed provider proof with exact route coverage and sparse
empty proof, plus first Thread cached root/reply provider proof, bounded
Thread bootstrap relay-read proof, explicit Thread older-page relay command
proof, scroll-triggered plus viewport-fill Thread older request proof, bounded
Thread live reply-window proof, focused-reference Thread hydration proof,
bounded cached Thread parent-chain proof, terminal unavailable-parent rows,
Thread continuation rows, feed/form tab track-edge alignment, and converted
feed structural, pane-body, horizontal-overflow, Public Chat, and lkjstr Log scroll-owner
boundaries; the shared Rust
feed core now proves owner release cleanup across every shared `QuerySurface` plus Search app/UI demand,
provider execution, local indexed rows, bounded relay NIP-50 merge proof,
Search tab snapshot restore, cached plus relay older-page proof, cached plus
relay-refreshed Profile
metadata/follow-count header rendering, selected-relay plus stored-route
Followees/User Timeline kind `3` discovery, Followees/User Timeline cleanup,
retry diagnostics, and Rust island host proof, first injected/cache/relay
Author Context rows, exact anchor lookup, stored routes, unavailable-state browser
proof, row actions, Profile/Thread/Notifications runtime, Search query-runner, Custom Request app/UI/Web proof, and no-import guards,
plus Followees/User Timeline/Author Context request-level and read-command cleanup guards. Global, Thread, Notifications,
and Search older controls require real older handlers before older dispatch,
released older-provider leases suppress late completions, and Search primary query plus Custom Request run commands release
replaced or provider-unavailable leases. The unused
Rust workspace-persistence constructor that dropped tab snapshots is removed.
Profile following-count rows render as actions only when a real Followees opener
exists.
Do not skip this order for visible polish.
