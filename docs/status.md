# Status

## Purpose

What works, what remains, and the current engine cutover. The architecture in
[engine.md](engine.md) supersedes browser-runtime assumptions of the old UI.

## Worker engine (2026-11-14)

`lkjstr-engine` is a new Rust/WASM crate, with no DOM or Leptos dependency.
Sockets and IndexedDB moved out of the old browser crate; its compatibility
imports keep the existing Trunk build available. Worker-safe timers have owned
cancellation. The existing UI is retained for the independent frontend rewrite;
no files under web/ are part of this change.

The pure engine lives in `lkjstr-core::engine`. Its wire adapter mirrors the
authoritative frontend protocol committed during this run: t/a/k tags, flat
filters, millisecond times, typed rows, key patches and signer JSON strings.

Implemented paths:

- Cache-first queries, stable event IDs, anchored bounded windows, 75 ms patches,
  fresh counts, content segmentation, emoji, imeta dimensions/alt, embedded
  quotes to depth two, reply/repost contexts, grouped reposters, partial counts,
  own reaction/repost/bookmark/mute state and hidden reasons.
- Visible-row profile and reference hydration; NIP-05 is verified only with
  exact-key HTTP evidence, redirect rejection and a bounded response.
- Home/global/profile/thread/notification/search/hashtag/bookmark/list/relay
  source selection and author/time/reply/repost/media/text/language filters.
  Specialized profiles, people, notifications, mutes, relays and diagnostics
  use the frontend row kinds; private/addressable list coverage is incomplete.
- NIP-07 exact-event signing bridge, deadlines, notes/replies/quotes/reposts,
  Unicode/custom reactions, own-event deletion, loaded-list follow/mute/bookmark
  edits, profile and relay-list saving. Unknown tags/private content survive.
- SharedWorker entry with isolated client IDs and visibility, plus dedicated
  Worker entry. Visibility is isolated per client. Abrupt-port cleanup requires
  an agreed detach/heartbeat contract; healthy silent clients never expire.
  Dedicated fallback leader election is designed but not implemented.
- Identical wants share requests. Visibility releases requests/sockets. Reads
  select two relays, publications up to three; configuration caps at eight.
  Per-relay request caps, rate spacing, NIP-11 limits, EOSE latency, usefulness,
  silent-socket/subscription watchdogs, reconnect backoff and since overlap.
- Signature verification uses bounded off-callback slices. Memory and pending
  writes are bounded. IndexedDB commits retry. Startup reads a recent slice.
- Runtime diagnostics and native/WASM benchmark harnesses. Sparse multi-author
  queries merge indexes rather than scanning the whole event store.

Still required:

- Complete frontend integration, notification grouping/read state and private
  or addressable list models. Language matching without explicit tags is an English/Japanese
  script heuristic, not a language detector.
- Upload transport with Blossom/NIP-96 fallback and progress; local-key account
  management and remote signers in the engine. Upload currently returns a
  specific unsupported error rather than fabricated success.
- Dedicated-worker leader election, outbox-aware routing in the new scheduler,
  more aggressive author/filter coalescing and adaptive network hints.
- Disk retention/compaction and a cold-start test with 100000 physical rows.
  The existing event JSON format remains; compact storage is not claimed.
- Wider end-to-end coverage for all actions, malformed/rate-limited relay
  behavior, prolonged suspension and client-heartbeat recovery.

## Verification and measurements

See [verification.md](verification.md) for the repository gates and restrictions.
Engine tests drive serde messages, held anchors, signer substitution, queue
bounds, shared ownership, missing responses and a three-hour idle/reconnect.
The 20 native engine tests and 16 headless checks pass. Final verify:quiet
passes, including the Trunk release build. The harness uses fresh local data
and a loopback fake relay.
[Performance](engine-performance.md) records the measured workload: 100 sparse
queries over 100000 events improved from 3087.80 ms to 2.49 ms in the final
run (1.88 ms immediately after the isolated index optimization).

Docker Compose verification remains excluded by the explicit worktree-only
write rule because Docker image/container storage is outside the worktree.
No commit, deployment, production access or running-service restart is made.

## Retained application

The existing Leptos app and its previous browser smoke remain in the tree. It
has tiled workspaces, local/NIP-07 accounts, feeds, thread/search/profile views,
optimistic publishing, IndexedDB cache and the previous request planner. Its
prior 129-check browser result is historical and does not verify the new
Worker integration. The new TypeScript frontend is owned by another worktree.
