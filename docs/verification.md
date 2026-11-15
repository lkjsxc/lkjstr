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
HTTP is intercepted, relays are loopback fixtures, and no checks publish to
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

Engine polish adds native tests for profile routing/batching/context, count
states and Global filtering, plus the delayed loopback profile check and a
mock count regression. Results and handoff decisions are in engine-polish.md.
Historical integration measurements remain in integration-release.md and
engine-performance.md; old Leptos browser results do not verify this product.

The integration gate record is in integration-release.md. The real smoke covers
creation/backup, visitor relay persistence, injected extension rejection and
60-second deadlines, and encrypted bunker connect/sign/reload/outage/recovery.
Signer scenarios record result codes without retaining action or key payloads.
The earlier rejected-send/reload failure is fixed by the merged frontend's
immediate draft saving; both reload signer scenarios now pass. Pagination regressions also run against the
pre-review scheduler in ignored tmp/ evidence, proving they detect the old bugs.
Docker remains excluded by the worktree-only write rule.

## Owner feedback checks (2026-11-15)

All four quiet gates pass: check:repo, test:quiet, rust-wasm:quiet and verify:quiet.
Conformance passes 134/134 checks with no page errors, including discovery for
NIP-07, NIP-46 and restored local signers, immediate server-list-aware upload,
client tags, default Blossom/NIP-96 and 5000 relay-paged rows with timestamp ties.
Twelve native regressions cover discovery, bounds, tags, upload selection, stats,
retained windows and history refill/preemption. Frontend check, build and smoke
also pass with the additive protocol/stub mirror. Reports are under ignored tmp/.
The release and conformance builds run sequentially because they share temporary
Worker assets. Docker is excluded by the worktree-only write restriction.
No commit, CI change, production access, deployment or existing-service restart.

## Discovery relay-limit review (2026-11-15)

Both review findings are fixed. Three native regressions cover discovery yielding
to a feed and resuming after close, all three kinds with max_limit=1 or 2 and a
single slot without views, independent reconnect cursors, and settled discovery
resumption without subscription cycling. The four quiet gates pass with four
build jobs and test threads; caches remain in ignored tmp/.
The loopback Worker conformance gate and delayed profile probe also pass.
Docker was not run because its storage writes are outside this worktree.

## Protocol 3 integration (2026-11-15)

All four quiet gates and web check, build, smoke and smoke:real pass. Worker
conformance passes 164/164 with no page errors; the delayed profile probe
passes. Real smoke is 73/73, including all 39 signer checks. Eight new native
regressions cover rich filters, profile kinds, NIP-05, retained windows, mixed
paging, deferred repost hydration and grouped fresh counts. Details and files:
[protocol3.md](protocol3.md). Docker remains excluded by the worktree-only rule.

## Protocol 4 channels (2026-11-15)

All four quiet gates pass: check:repo, test:quiet, rust-wasm:quiet and verify:quiet.
Worker conformance passes 211/211 checks with no page errors; the delayed profile
probe and frontend pnpm check also pass. Nineteen native channel regressions cover
metadata authority, list order, references/hints, filters, thread/notification
context, authored tags, device marks, index isolation, timestamp paging, bounded
creates and single-slot relay rotation. The Worker suite covers all seven requests,
including 230 channel messages with timestamp ties, pending/confirmed publication,
muting/deletion and joined-list recovery in a fresh device context.
Implementation and bounds: [channels.md](channels.md). Reports and gate logs are
under ignored tmp/. All builds/tests use at most four jobs and worktree caches.
Docker is excluded by the worktree-only write rule. No commits, CI edits,
production access, deployments or existing-service restarts were performed.

The merged channels frontend passes pnpm check (63 tests), build and mock smoke.
Real UI smoke passes 81/81, including all 39 signer checks, channel creation,
list navigation, posting, Thread replies, edits, join/leave, client-tag Settings
and Stats. Early create/join waits for the owner-list lookup instead of racing
it; failed lookups expire without overwriting an unknown list. All four quiet
gates, expanded conformance and the delayed profile probe pass after that fix.

## Channel branch review (2026-11-15)

All four findings are fixed. Native regressions cover channel/Global progress
and resumption on one-slot relays, and target reservation at 1000 discovery ids.
UI regressions cover discovery loading/failure/empty phases, complete failed-draft
retry across remount and account switches, and bounded pending/failed drafts.
All four quiet gates, real UI smoke and Worker conformance pass; the delayed
profile probe passes without page errors. Frontend check, build, mock smoke and
composer/channel screenshots pass. Docker remains excluded by the worktree-only
write rule. Changes remain uncommitted; no CI or existing services were changed.

## Owner returning-profile audit (2026-11-15)

Shared mock/real checks capture dark views at 1440 and 390, upgrade historical
bundles on the same origin/storage and retain real-engine rows after reading
past 800. Failure/retry checks inspect saved drafts while the input is free;
a remount test protects the next draft from late results. Scope and open gaps:
[owner-audit.md](owner-audit.md).

Owner audit final: frontend check, build, shots and 432-check mock smoke pass.
All four quiet gates pass; Worker conformance passes 211 checks without page
errors. Two consecutive real UI smokes pass 166 checks each with no page errors.
Historical UI upgrades pass 28 checks; actual historical WASM/IndexedDB/cache
upgrades pass 34, including saved periods and retained Shortcuts page identity.
Public Channels discovery and Stats fetch purposes remain open; see owner-audit.md.

## Main and owner audit integration (2026-11-15)

The merged tree keeps main's scrolling, windowing and time rail implementation
and the owner audit's draft, migration and browser isolation repairs. Width
checks allow two pixels beside the rail. Mock smoke reports and server-start
failure handling survive.
Frontend check/build, all four quiet gates and mock smoke (441 checks) pass.
Real smoke with LKJSTR_SHOTS=1 passes 174 checks without page errors. Desktop
and phone rail captures were reviewed. Docker remains excluded by the
worktree-only write rule. No CI workflows or existing services were changed.
Worker conformance passes 216 checks with no page errors; the delayed
profile probe also passes. Gate logs are under ignored tmp/merge-*.log.

## Orchestration (2026-11-15)

All four quiet gates and frontend check/build/mock smoke pass. Stats captures
pass at 1440 dark English and 390 dark Japanese. Conformance passes 211/211
with no page errors; the delayed profile probe measures 229.1 ms at 240 ms delay.
Read/publication scorecards, public read-only observation, bounds and deferred
design: orchestration.md and ignored tmp/orchestration-report.md. Two real UI
smokes pass 84/84 with no page errors; an interrupted driver (exit 143) was rerun
standalone. Real Stats captures were inspected at 1440 and 390 in one tile.
Docker is excluded by the worktree-only write rule. No commits, CI edits,
production access, deployments or existing-service changes occurred.

## Orchestration branch review (2026-11-15)

Three native regressions preserve page evidence across quality changes, allow
new pages/configuration and keep hints from displacing routes. Pagination fails
against the pre-fix selector. Two Stats regressions cover publication states,
cap reasons, idle relays, repeated URLs and 32 x 2240 distinct destinations.
All four quiet gates pass with four build jobs/test threads and worktree caches.
Worker conformance passes 211/211 checks with no page errors; the delayed profile
probe also passes. Gate logs are under ignored tmp/review-*.log.
Docker remains excluded by the worktree-only write rule; no commit, CI edit,
production access, deployment or existing-service change was performed.
