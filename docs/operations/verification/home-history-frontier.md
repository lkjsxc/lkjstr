# Home History Continuation Frontier Verification

## Purpose

2026-09-29 follow-up to [explicit Home history](home-history.md), starting from
`9dc4376c5229fa516f6e86743122e2b62f902450`. This changes the Rust Home paging
path, not retained TypeScript feeds, production deployment, or cache coverage.

The displayed oldest row is no longer the next wire boundary. Each completed
exact relay/filter prefix constrains a separate common continuation. Raw
inclusive-boundary duplicates participate in that calculation, while the UI
continues to admit only rows strictly after its timestamp/id cursor. Missing,
failed, partial, cancelled, capped, or nonterminal scope evidence pins the prior
bound. Gap refill keeps the nearest/newest bounded prefix rather than a sparse
old tail, and continuation cannot pass rows trimmed from that prefix.

The 180-event raw budget reserves one slot and divides the remaining 179 across
relay/filter scopes; the initial per-scope target remains at most 30. The visible
window stays bounded at 180. Oversized input to a smaller reusable window keeps
its nearest prefix before rolling out previously displayed newer rows.

## Focused Evidence

Before the source fix, both tests in `home_feed_gap_test` failed: a sparse tail
survived while freshly filled gap rows were discarded. Both now pass. An
additional sequence exposed oversized-input tail retention; nearest-prefix
admission fixed that independently of the normal 180-event browser budget.

Twenty native checks pass across these targets:

```sh
cargo test -p lkjstr-app \
  --test home_feed_gap_test --test home_feed_paging_test \
  --test home_feed_frontier_test --test home_feed_frontier_boundary_test \
  --test home_feed_history_sequence_test --test home_feed_frontier_overlap_test
```

They cover exact relay/filter scopes, missing/duplicate relay completion,
partial/failed states, raw tied-boundary duplicates, subscription/author/relay
admission, provenance, retention clamping, and bounded repeated reads. The
sequence fixtures use 420 dense plus 70 sparse events with window caps 5, 17,
and 180. Shared-tail fixtures visit every event. Stationary-scope fixtures
preserve the reached prefix and stop without claiming all history was read.

Manual Chrome 154.0.8037.57 / matching ChromeDriver checks passed (2 history
checks plus 1 existing provider check):

```sh
wasm-pack test --chrome --headless --chromedriver "$CHROMEDRIVER" \
  crates/lkjstr-web --test home_feed_older_test \
  --test home_feed_relay_provider_test
```

`WASM_BINDGEN_TEST_WEBDRIVER_JSON` selects that browser and
`WASM_BINDGEN_TEST_TIMEOUT=30` bounds the run. The new UI test observes a sparse
initial tail at time 10 but an actual next `until=100`, successful gap refill,
`until=90` retained across a failed read and a tied-boundary reply, bounded
wire limits, closed sockets, and ignored late events after unmount. Test-only
WebSocket fixtures are not public-relay or real-account evidence. Initial
fixed-30 assertions were updated to the shared wire-budget contract.

Touched-crate native/WASM Clippy, WASM test compilation, repository checks,
document links, and line limits passed. The retained TypeScript/Vitest run
executed the full suite: 373 files / 1,229 tests passed. Rust app feed-filtered
checks and complete storage/relay crate tests also passed.

## Resumed Review (2026-09-30)

An additional regression exposed ambiguous filter provenance: a broad filter
returned notes at 100 and 90, while a narrow overlapping filter returned reposts
at 10 and 5. The union incorrectly moved continuation to 5. The new test failed
before the guard and passes afterward, including both filter orders, initial and
known cursors, and a short broad response. Matching multiple filters now pins the
prior boundary; current Home emits one filter and is unaffected by that guard.
NIP-01 returns a filter union, not per-event filter identifiers; see the
[primary protocol definition](https://github.com/nostr-protocol/nips/blob/master/01.md).

The resumed native app/relay/storage run passed 558 tests with no failures or
ignored tests. Native and WASM all-target Clippy passed with warnings denied.
Repository checks first identified documentation line/prose limits and a missing
Purpose heading; those were corrected and the repository check passed.

## Boundaries and Next Work

This is a conservative common frontier, not independent per-relay scheduling.
A stationary scope can stop older progress for all scopes even when another
relay has more history. The retry diagnostic is intentional; no second is
subtracted and no short reply fabricates historical exhaustion. Independent
scope scheduling and exact boundary resolution are the next paging work.
More than 179 scopes can still reach the raw cap despite a minimum limit of 1.
A same-second prefix exceeding its effective limit can also remain stationary.

Continuation evidence is not persisted complete cache coverage and cannot
suppress another relay read. NIP-65 routing, older cache coverage, automatic
scroll paging, and Home/TypeScript deletion parity remain open. No signing,
Nostr publishing, public DNS/TLS/GitOps changes, or preview replacement is part
of this slice.

## Artifact Gates

The post-implementation artifact gate results and immutable source revision
will be recorded after those commands finish. Earlier slice artifact results
remain in [home-history.md](home-history.md); they are not reused as proof of
this candidate.
