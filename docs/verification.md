# Verification

## Purpose

Gates for the sole TypeScript frontend and Rust/WASM Worker product.

## Quiet gates

Each root gate prints one ok line on success and a bounded tail on failure.

| Command | Runs |
| --- | --- |
| pnpm check:repo | doc topology, line caps and Rust style rules |
| pnpm test:quiet | fmt, native/WASM clippy, cargo test --workspace |
| pnpm rust-wasm:quiet | Rust gates, real frontend/Worker build, dist check |
| pnpm verify:quiet | repo checks plus the rust-wasm gate |
| sh scripts/engine-check.sh | loopback Worker conformance and delayed profile probe |

No Trunk installation or second interface is involved. The root Cargo.toml is
a virtual workspace; crates/lkjstr-engine-worker builds the browser engine.
Use CARGO_BUILD_JOBS=4 and RUST_TEST_THREADS=4 on shared hosts. Put caches in
ignored tmp/: CARGO_HOME, XDG_CACHE_HOME, XDG_CONFIG_HOME, XDG_DATA_HOME and
TMPDIR. Set LKJSTR_WASM_BINDGEN to the matching wasm-bindgen-cli if needed.

## Frontend and real browser gates

In web/, run pnpm check, pnpm build and pnpm smoke for the mock test double.
Then run pnpm build:real and pnpm smoke:real for the shipped engine graph.
The real check covers Global/Home, note/profile/thread navigation, search,
compose/sign/publish, reactions, relay settings across reload and two tabs.
All browser servers bind fresh loopback ports and use fresh local data.
HTTP uses loopback TLS media fixtures or interception, relays are loopback
fixtures, and no checks publish to
public relays. browser-relay.mjs remains a shared bounded fixture helper.
The Leptos-only browser drivers and their CSS/string guards have been removed.

The Worker harness validates replies against this worktree's protocol.ts and
drives every mock message kind, action name and query source. It includes
cache restart, signer validation, uploads, visibility release, shared clients,
leader loss and a simulated idle clock. The optional cold-start benchmark is
separate. Reports live under tmp/engine-harness/ and tmp/smoke-real/.

## Manual public sample

scripts/engine-public-sample.mjs is deliberately absent from automated gates.
It only sends REQ/CLOSE, saves public events locally, and never loads an account
or publishes. The one 200-note sample, signature verification, ten held excerpts
and policy limitations are recorded in engine-polish.md. Offline reanalysis:

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

The Dockerfile builds the same real frontend and Worker with Node/pnpm and
wasm-bindgen-cli. Docker is unavailable in this session and was not attempted.
No services, deployments, production systems or CI workflows were changed.

## Current record

Engine polish adds native tests for profile routing/batching/context, count states and Global filtering, plus the delayed loopback profile check and a mock
count regression. Results and handoff decisions are in engine-polish.md. Historical integration measurements remain in integration-release.md and engine-
performance.md; old Leptos browser results do not verify this product.

The integration gate record is in integration-release.md. The real smoke covers creation/backup, visitor relay persistence, injected extension rejection
and 60-second deadlines, and encrypted bunker connect/sign/reload/outage/recovery. Signer scenarios record result codes without retaining action or key
payloads. The earlier rejected-send/reload failure is fixed by the merged frontend's immediate draft saving; both reload signer scenarios now pass.
Pagination regressions also run against the pre-review scheduler in ignored tmp/ evidence, proving they detect the old bugs. Docker remains excluded by the
worktree-only write rule.

## Owner feedback and discovery review (2026-11-15)

All four quiet gates, frontend check/build/smoke, loopback conformance and the 240 ms delayed profile probe pass. Conformance covers 134 checks for
restored signers, server-aware uploads, client tags, Blossom/NIP-96 and 5000 paged rows with timestamp ties. Native regressions cover discovery, bounds,
stats, retained windows, history refill/preemption, and single-slot yielding/resumption with per-kind max_limit=1 or 2 and independent reconnect cursors.
Results and reports: engine-polish.md, owner-feedback.md and ignored tmp/. Builds use four jobs and worktree caches; release and conformance builds run
sequentially. Docker is excluded by the worktree-only write rule. No commits, CI edits or service changes.

## Protocol 3 integration (2026-11-15)

All four quiet gates and web check, build, smoke and smoke:real pass. Worker conformance passes 164/164 with no page errors; the delayed profile probe
passes. Real smoke is 73/73, including all 39 signer checks. Eight new native regressions cover rich filters, profile kinds, NIP-05, retained windows,
mixed paging, deferred repost hydration and grouped fresh counts. Details and files: [protocol3.md](protocol3.md). Docker remains excluded by the worktree-
only rule.

## Protocol 4 channels (2026-11-15)

All four quiet gates pass: check:repo, test:quiet, rust-wasm:quiet and verify:quiet. Worker conformance passes 211/211 checks with no page errors; the
delayed profile probe and frontend pnpm check also pass. Nineteen native channel regressions cover metadata authority, list order, references/hints,
filters, thread/notification context, authored tags, device marks, index isolation, timestamp paging, bounded creates and single-slot relay rotation. The
Worker suite covers all seven requests, including 230 channel messages with timestamp ties, pending/confirmed publication, muting/deletion and joined-list
recovery in a fresh device context. Implementation and bounds: [channels.md](channels.md). Reports and gate logs are under ignored tmp/. All builds/tests
use at most four jobs and worktree caches. Docker is excluded by the worktree-only write rule. No commits, CI edits, production access, deployments or
existing-service restarts were performed.

The merged channels frontend passes pnpm check (63 tests), build and mock smoke. Real UI smoke passes 81/81, including all 39 signer checks, channel
creation, list navigation, posting, Thread replies, edits, join/leave, client-tag Settings and Stats. Early create/join waits for the owner-list lookup
instead of racing it; failed lookups expire without overwriting an unknown list. All four quiet gates, expanded conformance and the delayed profile probe
pass after that fix.

## Channel branch review (2026-11-15)

All four findings are fixed. Native regressions cover channel/Global progress and resumption on one-slot relays, and target reservation at 1000 discovery
ids. UI regressions cover discovery loading/failure/empty phases, complete failed-draft retry across remount and account switches, and bounded
pending/failed drafts. All four quiet gates, real UI smoke and Worker conformance pass; the delayed profile probe passes without page errors. Frontend
check, build, mock smoke and composer/channel screenshots pass. Docker remains excluded by the worktree-only write rule. Changes remain uncommitted; no CI
or existing services were changed.

## Media upload repair (2026-11-15)

Frontend check passes 69 tests. The ordinary smoke also runs a real TLS media matrix for both protocols and all three signers; the full real smoke passes
251 checks twice consecutively, with zero page errors and review screenshots. Eleven-second responses catch the old HTTP deadline; stalled headers/bodies,
wrong/refused/missing signers, metadata checks, retained files, another-server retry and narrow Japanese failure controls are covered. Request/auth unit
tests and a cross-language default-list guard remain in the repository. Fresh accounts show neutral unconfirmed server rows instead of false no-response
failures. The manual public sample is excluded from gates. See media-uploads.md for bounds and ignored tmp/upload-report.md for per-server results and
incomplete cleanup. Docker is excluded by the worktree-only write rule. No commits or CI edits.

## Media server status mark (2026-11-15)

Native verdict/selection tests and a Settings rendering test cover unknown, required failure and recovery. Both smoke gates cover a root without CORS,
working uploads, row Retry, optional BUD-06 failure, persisted old-down reset, shared reasons and ordered fallback. Discovery and processing GETs delayed
by 11 seconds pass with the same 30-second deadline as upload. All quiet gates and frontend check/build/smoke/shots pass. Conformance is 212/212; two
consecutive real smokes are 263/263 each, with zero page errors. Captures: tmp/shots/servers-{1440,390}-dark.png. Public fresh/ca2b23fd profile samples
show all four current defaults answering after successful upload; details and files are in ignored tmp/upload-report.md. Docker is excluded by the
worktree-only write rule. No commits, CI edits, deployments or existing-service operations.

## Upload branch review (2026-11-15)

All four findings are fixed. Seven native upload policy tests include regressions for the aggregate budget, protocol retention, concurrent verdicts and
exhausted selection versus an empty list. Worker conformance passes 224/224 checks with zero page errors, including 12 new upload checks. Its monotonic
test clock proves HTTP, discovery, signing and processing share one budget; a late signer reply cannot resume an expired upload. Restored Blossom endpoints
recover through both row checks and explicit retries. The delayed profile probe also passes. All four quiet gates and frontend check/build/smoke/smoke:real
pass. The ordinary smoke includes 128 real upload checks; the full real smoke has zero page errors. Docker is excluded by the worktree-only write rule.
Changes remain uncommitted; no CI edits, production access, deployments or existing-service changes occurred.

## Notes, reader state, previews and branch review (2026-11-15)

Frontend check/build/mock smoke, four quiet gates, 211-check Worker conformance and the delayed profile probe pass. Two real smokes pass 116 checks each,
including a minute of arrivals, reveal/unfold persistence, metadata patches, reload/reopen, profile kinds, zoom/audio, Docs, Stats, Settings, dates and tab
search. Off/data-saver and covered-note request checks pass. Native preview checks cover refusal, deadlines/redirects, charset, cache
bounds/expiry/restart, CORS, permission and one-attempt policy. The card/tab-search matrix has 56 captures at 1440/390, both themes/languages; service
handoff: ignored tmp/. Branch review fixes immediate channel draft saving, Enter/debounce, pending results, composition/remount, notification/mixed-feed
previews and scroll hydration/reset/reattachment. Regressions reproduce pre-fix failures; Chromium checks Docs reset. Frontend check/build/mock/real smoke
and four quiet gates pass; channel/notification shots pass at 1440 light/en and 390 dark/ja. Changes stay uncommitted with worktree caches/artifacts.
Docker is excluded by the worktree-only rule. No CI edit, service restart, production access or deploy.

## Owner returning-profile audit (2026-11-15)

Shared mock/real checks capture dark views at 1440 and 390, upgrade historical bundles on the same origin/storage and retain real-engine rows after reading
past 800. Failure/retry checks inspect saved drafts while the input is free; a remount test protects the next draft from late results. Scope and open gaps:
[owner-audit.md](owner-audit.md).

Owner audit final: frontend check, build, shots and 432-check mock smoke pass. All four quiet gates pass; Worker conformance passes 211 checks without page
errors. Two consecutive real UI smokes pass 166 checks each with no page errors. Historical UI upgrades pass 28 checks; actual historical
WASM/IndexedDB/cache upgrades pass 34, including saved periods and retained Shortcuts page identity. Public Channels discovery and Stats fetch purposes
remain open; see owner-audit.md.

## Main and owner audit integration (2026-11-15)

Integration keeps main's scrolling, windowing/time rail and the audit's draft, migration/browser isolation repairs, mock reports and startup failure
handling. Width checks allow two pixels beside the rail. Frontend check/build, four quiet gates and 441-check mock smoke pass; real smoke with
LKJSTR_SHOTS=1 passes 174. Worker conformance passes 216 checks; delayed profile and desktop/phone captures pass. No page errors. Logs: ignored
tmp/merge-*.log. Docker is excluded by the worktree-only write rule. No CI workflows or existing services were changed.

## Orchestration and branch review (2026-11-15)

Four quiet gates and frontend check/build/mock smoke pass. Stats captures pass at 1440 dark/en and 390 dark/ja; real Stats were inspected in one tile.
Conformance passes 211 checks without page errors; the delayed profile probe measures 229.1 ms at 240 ms delay. Two real UI smokes pass 84 checks each; an
interrupted driver was rerun standalone. Scorecards, bounds and deferred work: orchestration.md and ignored tmp/orchestration-report.md. Review adds three
native regressions for page evidence across quality changes, new pages/configuration and route stability. Pagination fails on the old selector. Two Stats
regressions cover states, caps, idle/repeated relays and 32 x 2240 routes. Four quiet gates, 211-check conformance and the delayed probe pass with four
jobs/threads and worktree caches. Logs: ignored tmp/review-*.log. Docker is excluded by the worktree-only rule. No commit, CI edit, production access,
deployment or existing-service change occurred.

## Notes/main merge (2026-11-15)

Four quiet gates, frontend check/build, mock (302) and real (207, with shots) smoke, shots and conformance (216) pass. Harness merge is committed. Review
keeps both suites and main's time rail; strict protocol 5 conformance is restored. Logs: tmp/reconcile-*.log.

## Media upload/main merge verification (2026-11-15)

Composer keeps retained upload controls and main's owner-scoped outbox.
Upload and protocol-5 time-rail/reader suites both run. The server capture closes
before restoring the shared layout, preserving the original composer tab.
Four quiet gates and web check/build pass; mock smoke is 302/302 and upload
smoke is 128/128. Real smoke with shots is 386/386 with zero page errors.
Desktop/phone review captures and 229-check conformance pass; the delayed profile
probe measures 229.6 ms at 240 ms delay. Fresh logs: ignored tmp/reconcile-*.
The harness committed the merge; Git has no unmerged entries or conflict markers.
Signer reload checks require saved state, a retryable retained post and the exact
latest edit. No commit, CI edit, Docker, production, deployment or service work.
