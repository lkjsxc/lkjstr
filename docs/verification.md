# Verification

## Purpose

Gates for the sole TypeScript frontend and Rust/WASM Worker product. Resource bounds: [engine-shipping.md](engine-shipping.md).
## Quiet gates

Each root gate prints one ok line on success and a bounded tail on failure.

| Command | Runs |
| --- | --- |
| pnpm check:repo | doc topology, line caps and Rust style rules |
| pnpm test:quiet | fmt, native/WASM clippy, cargo test --workspace |
| pnpm rust-wasm:quiet | Rust gates, real frontend/Worker build, dist check |
| pnpm verify:quiet | repo checks plus the rust-wasm gate |
| sh scripts/engine-check.sh | loopback Worker conformance and delayed profile probe |

The virtual workspace builds crates/lkjstr-engine-worker. Use CARGO_BUILD_JOBS=4 and RUST_TEST_THREADS=4 on shared hosts. Put caches in ignored tmp/:
CARGO_HOME, XDG_CACHE_HOME, XDG_CONFIG_HOME, XDG_DATA_HOME and TMPDIR. Set LKJSTR_WASM_BINDGEN to the matching wasm-bindgen-cli if needed.

## Frontend and real browser gates

In web/, run pnpm check, pnpm build and pnpm smoke (mock UI plus real loopback uploads). Then run pnpm build:real and pnpm smoke:real for the shipped
engine. The real check covers Global/Home, note/profile/thread navigation, search, compose/sign/publish, reactions, relay settings across reload and two
tabs. All browser servers bind fresh loopback ports and use fresh local data. HTTP uses loopback TLS media fixtures or interception, relays are loopback
fixtures, and no checks publish to public relays. browser-relay.mjs remains a shared bounded fixture helper.

The Worker harness validates replies against this worktree's protocol.ts and drives every mock message kind, action name and query source. It includes
cache restart, signer validation, uploads, visibility release, shared clients, leader loss and a simulated idle clock. The optional cold-start benchmark is
separate. Reports live under tmp/engine-harness/ and tmp/smoke-real/.

## Manual public sample

scripts/engine-public-sample.mjs is deliberately absent from automated gates. It only sends REQ/CLOSE, saves public events locally, and never loads an
account or publishes. The one 200-note sample, signature verification, ten held excerpts and policy limitations are recorded in engine-polish.md. Offline
reanalysis:

```sh
cargo run -q -p lkjstr-core --example engine-global-sample \
  < tmp/public-sample/events.json > tmp/public-sample/report.json
```

## Docker

Docker Compose verify remains the final gate where Docker is available:

```sh
docker compose --progress quiet -f docker-compose.yml build verify
docker compose --progress quiet -f docker-compose.yml run --rm verify
```

The Dockerfile builds the same real product. Docker is excluded by the worktree-only write rule; no services, deploys, production or CI changes occur.

Harness merge 9e03b662 retains cover repairs, main's frontend/time rails and all smoke assertions; no code repair was needed. Four quiet gates and
frontend check/build/smoke pass (417 mock, 128 uploads); real smoke passes 534 checks with LKJSTR_SHOTS=1 and no page errors. Evidence: tmp/current-merge-*.

## Earlier integration and review

Engine polish covers profile routing/batching/context, counts and Global filtering. Focused-tail, pagination and lazy-graph regressions reject the old
scheduler/eager weights. Four quiet and loopback conformance/profile gates pass with four jobs and worktree caches (tmp/review-*.log). Details:
engine-polish.md, integration-release.md and engine-performance.md; old Leptos checks do not verify this product.

Real smoke covers creation/backup, visitor relays, extension refusal/60s deadlines and encrypted bunker connect/sign/reload/outage/recovery.
Reports omit action/key payloads. Immediate draft saves repair rejected-send/reload; both signer reload scenarios pass.

## Owner feedback and discovery review (2026-11-15)

All four quiet gates, frontend check/build/smoke, loopback conformance and the 240 ms delayed profile probe pass. Conformance covers 134 checks for
restored signers, server-aware uploads, client tags, Blossom/NIP-96 and 5000 paged rows with timestamp ties. Native regressions cover discovery, bounds,
stats, retained windows, history refill/preemption, and single-slot yielding/resumption with per-kind max_limit=1 or 2 and independent reconnect cursors.
Results and reports: engine-polish.md, owner-feedback.md and ignored tmp/. Builds use four jobs and worktree caches; release and conformance builds run
sequentially.

## Protocol 3 integration (2026-11-15)

All four quiet gates and web check, build, smoke and smoke:real pass. Worker conformance passes 164/164 with no page errors; the delayed profile probe
passes. Real smoke is 73/73, including all 39 signer checks. Eight new native regressions cover rich filters, profile kinds, NIP-05, retained windows,
mixed paging, deferred repost hydration and grouped fresh counts. Details and files: [protocol3.md](protocol3.md). Docker remains excluded by the
worktree-only rule.

## Protocol 4 channels (2026-11-15)

All four quiet gates pass: check:repo, test:quiet, rust-wasm:quiet and verify:quiet. Worker conformance passes 211/211 checks with no page errors; the
delayed profile probe and frontend pnpm check also pass. Nineteen native channel regressions cover metadata authority, list order, references/hints,
filters, thread/notification context, authored tags, device marks, index isolation, timestamp paging, bounded creates and single-slot relay rotation. The
Worker suite covers all seven requests, including 230 channel messages with timestamp ties, pending/confirmed publication, muting/deletion and joined-list
recovery in a fresh device context. Implementation and bounds: [channels.md](channels.md). Reports and gate logs are under ignored tmp/. All builds/tests
use at most four jobs and worktree caches.

The merged channels frontend passes pnpm check (63 tests), build and mock smoke. Real UI smoke passes 81/81, including all 39 signer checks, channel
creation, list navigation, posting, Thread replies, edits, join/leave, client-tag Settings and Stats. Early create/join waits for the owner-list lookup
instead of racing it; failed lookups expire without overwriting an unknown list. All four quiet gates, expanded conformance and the delayed profile probe
pass after that fix.

## Channel branch review (2026-11-15)

All four findings are fixed. Native regressions cover channel/Global progress and resumption on one-slot relays, and target reservation at 1000 discovery
ids. UI regressions cover discovery loading/failure/empty phases, complete failed-draft retry across remount and account switches, and bounded
pending/failed drafts. All four quiet gates, real UI smoke and Worker conformance pass; the delayed profile probe passes without page errors. Frontend
check, build, mock smoke and composer/channel screenshots pass.  Changes remain uncommitted; no CI or existing services were changed.

## Media upload repair (2026-11-15)

Frontend check passes 69 tests. The ordinary smoke also runs a real TLS media matrix for both protocols and all three signers; the full real smoke passes
251 checks twice consecutively, with zero page errors and review screenshots. Eleven-second responses catch the old HTTP deadline; stalled headers/bodies,
wrong/refused/missing signers, metadata checks, retained files, another-server retry and narrow Japanese failure controls are covered. Request/auth unit
tests and a cross-language default-list guard remain in the repository. Fresh accounts show neutral unconfirmed server rows instead of false no-response
failures. The manual public sample is excluded from gates. See media-uploads.md for bounds and ignored tmp/upload-report.md for per-server results and
incomplete cleanup.

## Media server status mark (2026-11-15)

Native verdict/selection tests and a Settings rendering test cover unknown, required failure and recovery. Both smoke gates cover a root without CORS,
working uploads, row Retry, optional BUD-06 failure, persisted old-down reset, shared reasons and ordered fallback. Discovery and processing GETs delayed
by 11 seconds pass with the same 30-second deadline as upload. All quiet gates and frontend check/build/smoke/shots pass. Conformance is 212/212; two
consecutive real smokes are 263/263 each, with zero page errors. Captures: tmp/shots/servers-{1440,390}-dark.png. Public fresh/ca2b23fd profile samples
show all four current defaults answering after successful upload; details and files are in ignored tmp/upload-report.md.

## Upload branch review (2026-11-15)

All four findings are fixed. Seven native upload policy tests include regressions for the aggregate budget, protocol retention, concurrent verdicts and
exhausted selection versus an empty list. Worker conformance passes 224/224 checks with zero page errors, including 12 new upload checks. Its monotonic
test clock proves HTTP, discovery, signing and processing share one budget; a late signer reply cannot resume an expired upload. Restored Blossom endpoints
recover through both row checks and explicit retries. The delayed profile probe also passes. All four quiet gates and frontend check/build/smoke/smoke:real
pass. The ordinary smoke includes 128 real upload checks; the full real smoke has zero page errors.


## Notes, reader state, previews and branch review (2026-11-15)

Four quiet gates, frontend check/build/mock smoke, 211-check conformance and 240 ms profile probe pass. Two real smokes pass 116 checks: live arrivals,
reader choices, metadata/reload/reopen, profile/zoom/audio, Docs/Stats/Settings, dates and tab search. Off/data-saver and covered-note request checks pass.
Native previews cover refusal, deadlines/redirects, charset, bounded cache, CORS, permission and one-attempt policy. Card/tab-search matrix: 56 captures,
1440/390, both themes/languages; handoff: tmp/. Review fixes immediate channel drafts, Enter/debounce/pending results, composition/remount, nested previews
and scroll hydration/reset. Regressions reproduce old failures; Chromium checks Docs reset. Mock/real gates and channel/notification shots pass. Worktree
caches, no commit/CI/service/production/deploy; Docker is excluded by the write rule.

## Owner-wishes branch review (2026-11-15)

Ten frontend regressions cover failed Edit swaps and attachments across remount, unchanged query commits, fresh/closed outbox state, late send isolation
and hidden mention subscriptions. The native follow-watch regression exercises eight combinations of arrival order, shared discovery and live/finite
timelines on a single-slot relay, including resumption, bounded rotation and close cleanup. The second browser notification batch waits past the retained
anchor second, so random same-second id ordering cannot place it below that anchor. Logs, retries and files: tmp/review-fixes-report.md.

## Owner returning-profile audit (2026-11-15)

Shared mock/real checks cover dark 1440/390 views, same-origin/storage historical upgrades, real rows past 800, failed-draft retry while typing and remount
safety. Scope/open gaps: [owner-audit.md](owner-audit.md). Frontend check/build/shots, 432-check mock smoke, four quiet gates and 211-check conformance
pass. Two real smokes pass 166 checks each without page errors. UI upgrades pass 28 checks; actual WASM/IndexedDB/cache upgrades pass 34, including periods
and Shortcuts identity. Public Channels discovery and Stats fetch purposes remain open.

## Main and owner audit integration (2026-11-15)

Integration keeps scrolling/time rails, draft/migration/browser isolation repairs, mock reports and startup failure handling. Width allows two pixels by
the rail. Frontend check/build, four quiet gates, 441-check mock smoke, 174-check real smoke with LKJSTR_SHOTS=1, 216-check conformance, delayed profile
and desktop/phone captures pass without page errors. Logs: tmp/merge-*.log. Docker is excluded by the worktree-only rule; no CI workflows or existing
services were changed.

## Orchestration and branch review (2026-11-15)

Four quiet gates, frontend check/build/mock smoke, 211-check conformance and 240 ms delayed profile probe pass (229.1 ms). Two real smokes pass 84 checks;
an interrupted driver was rerun. Stats captures: 1440 dark/en, 390 dark/ja and real Stats in one tile. Scorecards/bounds: orchestration.md and ignored
tmp/orchestration-report.md. Three native regressions preserve partial/completed page evidence through quality changes, new pages/configuration and route
stability; pagination fails the old selector. Two Stats regressions cover all states/caps, idle/repeated relays and 32 x 2240 destinations. Review gates
pass with four jobs/threads and worktree caches (tmp/review-*.log).

## Notes/main merge (2026-11-15)

Four quiet gates, frontend check/build, mock (302) and real (207, with shots) smoke, shots and conformance (216) pass. Harness merge is committed. Review
keeps both suites and main's time rail; strict protocol 5 conformance is restored. Logs: tmp/reconcile-*.log.

## Read orchestration follow-up (2026-11-15)

Four quiet gates, frontend check/build/mock smoke and 216-check conformance pass without page errors. The 240 ms delayed-profile probe measures 229.5 ms;
two real smokes pass 92 checks each on fresh loopback ports and browser contexts. An initial failure exposed healthy connection deadlines saved as retry
delays. Persistence now saves retry only for disconnected transports using engine time; healthy-reload/rollback regressions and shared ownership, fallback
leadership, reload and three-hour idle checks pass. Fresh wire IDs reject late cancelled EOSE; resumption asserts filter identity and fresh envelopes. Mock
Stats captures: 1440 dark/en and 390 dark/ja; real captures: outbox-stats-1440-dark and outbox-stats-390-dark. Scorecards, guarded public comparison and
omitted designs: [outbox.md](outbox.md), tmp/outbox-report.md. Docker is excluded by the worktree-only rule; no CI, production, deployment or
existing-service change occurred. These records predate the current merge.

## Harness merge verification (2026-11-15)

Harness merge 63fecba9 keeps both histories and read orchestration. Scrolling, windowing, time rails and smoke.ts/shots.ts/smoke-real.mjs match main. The
stricter deferred-filter-focus repair and its regression remain. Frontend check/build/mock smoke (302), four quiet gates and real smoke (207 with
LKJSTR_SHOTS=1) pass. Conformance (216) and the delayed-profile probe pass. No page errors. Logs: tmp/final-merge-*.log.

## Media upload/main merge verification (2026-11-15)

Upload/main keeps retry controls, owner-scoped outboxes and both upload/reader/time-rail suites. Server captures close before layout restoration to
preserve the composer tab. Four quiet gates and web check/build pass: mock 302, uploads 128, real 386 (shots), conformance 229; no page errors.
Desktop/phone captures pass; profile latency is 229.6 ms at 240 ms delay. Logs: tmp/reconcile-*. The harness committed that merge with no unmerged entries
or conflict markers. Reload checks require saved state, a retryable retained post and the exact latest edit. No CI, Docker, production, deployment or
service work.

## Current wishes/main reconciliation (2026-11-15)

Harness merge e292516a keeps wishes/follow watches/drafts and main's orchestration/uploads/reader/time rail. Both suites remain.
Signer reload requires the failed post and exact next draft for rejected and stalled signing. Four quiet gates and frontend check/build/smoke pass
(417 mock, 128 uploads), as does real smoke (534, LKJSTR_SHOTS=1, no page errors). Logs: tmp/merge-green-*.log. Desktop/phone rails reviewed.
No Docker, CI edits, commits, production, deploys or existing-service changes.
