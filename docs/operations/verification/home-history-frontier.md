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
The three manual Chrome checks were rerun after the overlapping-filter guard
and passed. The complete `pnpm rust-wasm:quiet` gate also finished successfully.
An earlier synchronous tool connection closed before returning that gate's
result; only the later logged run with final exit zero is counted.

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

The implementation is `c56e460eded307b144afaa5e8144e7d58d7a68f5`
(tree `79ac8736d02a0237a13ff18e2c561fcd41da0ff9`). Its first Docker build passed,
but the verification container found missing references to this document in
three documentation indexes. The documentation-only correction is the frozen
artifact source `48a2f8f2625837f2b08c6cb9b4bf3c5662e43b1e`
(tree `cca8890e3f5df5b620ab9116ac0042ac157bf95e`). Product code, tests, dependencies,
Docker configuration, and workflows are unchanged between those commits.

All these commands completed successfully on that corrected source:

- Docker Compose configuration and builds of `app`, `verify`, `cloudflare`,
  and `app-smoke`, followed by runs of all three verification services.
- The Docker verification plan: repository/documentation checks, Rust formatting,
  native/WASM Clippy, workspace Rust tests, release Trunk build, and the retained
  Node repository, lint, type-check, and Vitest gates.
- Emitted-WASM asset checks, a real local Cloudflare Worker smoke, and Wrangler
  deployment dry-run. No Worker was published.
- The `self-hosted` target, build-time and final-image Rust asset-tree checks,
  and an independently read image source-revision label.

The local image tag is `lkjstr:home-frontier-48a2f8f2`. Its image ID is
`sha256:6257bfd71cb7124d5a323e70d2098e2996de8022bfcad3c96dc4559711829ac9`.
It carries the exact corrected-source revision above and was not published to a
registry. Later evidence-report changes are documentation-only.

## Candidate Runtime Proof

A separate candidate was started by that image ID with a read-only root,
dropped capabilities, and a randomly assigned loopback port (`32768` for this
run). Rust readiness and `pnpm hosted:smoke` passed. Additional HTTP diagnostics
passed identity/gzip/Brotli delivery, manifest-listed bridge imports, SQLite
WASM validation, content headers, and 404/405/HEAD behavior.

A fresh Chromium context loaded the actual application and WASM assets without
page exceptions or local HTTP failures. Rejecting optional privacy processing
persisted across reload. This is startup/storage-choice evidence, not a signed
account workflow or real-public-relay Home history proof. The three controlled
Home provider/UI diagnostics above remain the history-specific browser evidence.
Browser suites remain manual and suspended in canonical quiet/Docker/CI gates.

The candidate container was removed after verification. The existing preview's
container ID, image ID, healthy state, and `127.0.0.1:18879` mapping were compared
before and after and remained identical. No public DNS, TLS, proxy, GitOps,
account, signing, publishing, or preview deployment state was changed.

Local logs are retained as `/tmp/lkjstr-home-frontier-validation-20260930.log`,
`/tmp/lkjstr-home-frontier-artifacts-c56e460e.log` (initial failed gate),
`/tmp/lkjstr-home-frontier-artifacts-48a2f8f2.log`, and
`/tmp/lkjstr-home-frontier-candidate-48a2f8f2.log`. The resumed validation,
corrected artifact, and candidate logs each contain `FINAL_RESULT: 0`.
