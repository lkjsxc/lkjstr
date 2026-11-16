# Historical route continuation

## Purpose

Record the bounded fix and evidence for a full historical route lost during
quality reranking at its inclusive cursor. No interface or protocol change is
required. Native and actual production Worker before/after checks pass.

## Failure and boundary

Home keeps a live head while requesting older pages. A relay that returned a
full page still owes its older tail. Previously stable-route selection matched
only the new logical page, while preceding-page retention covered unfinished
routes. A successful full predecessor therefore fell through both guards.
A newly preferred empty relay could replace it and establish false exhaustion.

The actual inclusive continuation now inherits the full predecessor's ordinary
read slot. This uses the existing two-primary bound and adds no collection or
extra primary slot. A still-owned full predecessor is also retained as historical
debt outside those slots when another view already occupies them at the same
cursor. This remains true after that route is demoted. Retention is bounded by
the configured permitted relays and current view/filter membership. A short
predecessor cannot acquire this protection or consume a new physical request.

The original filter family and cursor must match. A different explicit until
may rerank normally. Changed authors, read-permission removal and last-view
close release the old authority; late responses cannot revive a removed want.
Existing failed-route uncertainty and relay-local cursors remain unchanged.

## Native evidence

On 2026-11-16, the unchanged source at 37b14ab5 compiled and failed both the
missing-full-tail and false-exhaustion cases. Four controls passed before:
explicit different until, changed authors, revoked read permission and close.
The corrected source passed all six new cases and twelve adjacent route, cursor,
failed-route, recovery and head-fallback cases. Strict focused Clippy passed.

The final block ran at 16:49:51-16:50:10 UTC in 18.581 seconds, using four build
jobs and four test threads. Load was 1.81/1.85/2.02 to 1.93/1.88/2.03. Workspace
Rust/manifest mtimes were refreshed before each command to reject stale shared
target reuse. Original source, logs and metadata remain under
`tmp/history-route-proof/`. The initial five-case failure is retained separately.

A further two-view case compiled and failed against the first correction: a
second view's completed-short routes occupied both ordinary slots and discarded
the first view's full predecessor. The corrected debt guard passes that case,
including the next page after demotion. A disconnect control confirms a healthy
fallback can progress while the recovered route resumes its original span.
Eight focused and twelve adjacent tests, plus strict focused Clippy, passed at
17:09:02-17:09:16 UTC in 13.808 seconds; load was 2.06/1.50/1.58 to
1.97/1.50/1.58. Evidence is in `shared-before.log`, `shared-after.log` and
`shared-after.json` in the same directory. Earlier fixture-pacing attempts are
retained separately and are not counted as product regressions.

The corrected read planner SHA-256 is:

```text
925d5b6c7aaba2474afe50a08b809e01d44cdf17ee69a3fb14dde1ab545c72d2
```

The involved read-plan, network-plan, paging and exhaustion files are identical
in shipped 541e4a1e and source 37b14ab5. The proven defect therefore predates
the sixth candidate. This source comparison does not prove a particular public
relay observation was caused by it.

## Public observation and remaining checks

The completed sixth public run stopped at 1,903 distinct Home note IDs and
reported exhaustion. Exact receipts now show 200 distinct wire IDs on ditto,
then the inclusive cursor on an empty purple route. Of those bodies, 193 are
retained, filter-matching and independently signature-verified; seven are
unavailable. This corroborates the route transition without proving all 200
were admitted or quantifying an unqueried tail. The [coverage record](engine-performance-sixth-coverage.md)
keeps the source/cutoff limits. No public query or frozen-run mutation was added
by the native or Worker proofs.

Combined required gates passed as recorded below; post-change public
measurement remains pending.


## Production Worker proof

`scripts/engine-history-route.mjs` serves unmodified generated assets and uses
only fresh loopback sockets, browser data and signed public fixture notes.
There are no test-only Worker methods, saved accounts or public publications.
The relay advertises a three-event limit; B returns exactly three distinct notes
plus duplicates, then a delayed EOSE. Other permitted routes return empty pages.
B alone has the strictly older fourth note. The fixture checks its actual wire
limit, distinct response count and successful EOSE before judging continuation.

The unchanged production package fails all three product assertions: no B
continuation, no fourth note, and exhaustion from empty replacement routes.
The corrected package passes all five checks, retaining all head notes and
receiving the fourth note before the final short page establishes exhaustion.
No page or Worker errors occurred. The process reaps the fixture signer, browser,
relay sockets and server in its guarded lifetime.

Exact production WASM hashes:

```text
before 1c0b50bef2a56c5def00dba885358481fdad1037d9b9f2127ff233d5131a6f97
after  c7c7a7dd5d9fd30f0f768e9e523ad661b9646a465024b98add368b6bd6c5a46b
```

The final finite runs started at 17:13:42 and 17:13:46 UTC on 2026-11-16,
taking 3.050 and 4.896 seconds. Load was 3.13/2.61/2.05 before and
3.13/2.61/2.05 after. Reports, exact requests, IDs and timestamps are in
`tmp/history-worker-before/report.json` and `tmp/history-worker-after/report.json`.
The first successful reproduction pair remains separately in the `-try1` paths.
`tmp/history-worker-codes.json` records exit 1 before and exit 0 after. The final
package and helper are copied under `tmp/history-route-final`; the earlier 33b
package remains intermediate evidence, not the final corrected build.

Run this outside default gates against a prepared production package:

```sh
LKJSTR_ENGINE_PKG=tmp/engine-pkg node scripts/engine-history-route.mjs
```

The native `engine-fixtures` helper must already exist in `CARGO_TARGET_DIR`, or
be specified with `LKJSTR_ENGINE_FIXTURE_BIN`. The command never invokes Cargo.
`LKJSTR_ENGINE_REPORT` selects a fresh evidence directory.


## Combined release verification

All required gates ran serially on 2026-11-16 against source
`8cd22affe733dd865276fb48b37c9c76e845446d`, with four Cargo jobs and test threads.
Tracked source hashes stayed unchanged; each Cargo stage refreshed owned Rust
mtimes before building. Load is the start-of-command 1/5/15-minute average.
All gate cleanup records found no remaining owned child process.

| Gate | UTC start | Load | Seconds | Result |
| --- | --- | --- | --- | --- |
| root check:repo | 17:21:35 | 1.10/1.63/1.80 | 1.191 | passed |
| root test:quiet | 17:21:36 | 1.10/1.63/1.80 | 133.785 | passed |
| root rust-wasm:quiet | 17:23:50 | 5.50/4.12/2.76 | 121.851 | passed |
| root verify:quiet | 17:25:52 | 6.42/6.24/3.81 | 125.301 | passed |
| web check | 17:27:57 | 5.17/6.83/4.42 | 7.021 | passed |
| web build | 17:28:04 | 5.32/6.83/4.44 | 0.446 | passed |
| web smoke | 17:28:05 | 5.32/6.83/4.44 | 403.986 | passed |
| engine conformance | 17:34:49 | 1.46/3.40/3.67 | 290.992 | passed |
| web package | 17:39:40 | 3.91/3.81/3.77 | 0.646 | passed |

Engine evidence contains 452 main checks, five historical-route checks,
31 private-list checks, 72 retained-stop checks and 22 signer-deadline checks;
all passed without recorded page, Worker, fixture or cleanup errors. The
historical-route final verdict now includes cleanup/fixture error arrays, and
engine-check runs it after building the helper. Full web smoke also passed its
mock, layout, real upload/signer and offline lifecycle phases. This is not a
claim that the separate prescribed ship's full real-interface suite has run.

The checked production WASM SHA-256 is
`c7c7a7dd5d9fd30f0f768e9e523ad661b9646a465024b98add368b6bd6c5a46b`.
The distinct conformance harness WASM is
`fbd50e17a2d6698937516d164dd3d62f9671db3df34b8f8e81f75fb5623ddf85`.
The production index SHA-256 is
`ad1f46abea175eda9a5332bc3133200658262057d9967584601aa5ae551392c9`.
Exact packaging passed with an 8,550,400-byte raw tar and a 1,539,603-byte gzip.
The gzip SHA-256 is
`3124a583b981ab461dd63098cc9a680434f2c801412b59071d9118411f38ad51`.

The release-fix worktree retains `tmp/release-gates.json`, per-command logs,
source fingerprints, copied reports and immutable package/dist snapshots.
`tmp/release-fix-proof/final.json` maps the exact source, artifacts and reports.
The prescribed ship passed its real-interface and archive checks but failed at
the host operation. Its exact artifact and diagnosis boundary are recorded in
[engine-startup.md](engine-startup.md); no successful ship is claimed.
