# Search contract and retained people

## Purpose

How the existing Search and language-filter contract is projected by core,
which data it can use, and what has actually been verified.

## Status

This source candidate includes the seventh landing, ce05e292, and the measured
live-route corrections at 19bca1ee. Focused native tests, strict Clippy, the
Worker WASM check and seven real Worker checks now pass. The selector workload
below is a native debug measurement. Required combined gates and deployment
remain pending; no public search-completeness claim is made.

## Retained people

Ordinary Search prepends up to six matching people when its raw note window
reaches the newest end. It uses the retained, signature-verified kind-0
metadata directory. It adds no remote kind-0 search; existing author hydration
and explicit NIP-05 lookup retain their own behavior and limits.

Every nonempty query word must occur in at least one of name, display name or
NIP-05 metadata. Matching normalizes NFKC and case. Claimed NIP-05 text is
searchable without certifying its ownership; the existing Author verification
field remains authoritative.

The selector excludes the query account's public and authorized private
person mutes before applying the six-person limit. It orders own identity,
followed people and remaining matches, then normalized label and public key.
Follow/mute membership is prepared once per selection. The selector retains
only six candidates and does not rebuild the interaction graph.

Each subscription caches at most six projected rows, invalidated by metadata
or private-policy revision. Ordinary note arrivals do not rescan the metadata
directory. Query replacement, Close and synchronous private-cache revocation
clear the prefix cache. The existing subscription limit is 128.

## Note windows and anchors

Person keys use `search-person:<pubkey>`. Native note windows, numeric patch
indexes, Fresh counts and calendar counts remain note-only. The wire layer
temporarily removes the prefix while applying native patches, then compares
only the six-person prefix with a shared first-note boundary.

A currently delivered person header can anchor the first real note. An empty
note span remains at top. Unknown, stale or another subscription's person key
does not become a new note identity. The existing feed requests its next
window using note endpoints and note count, preserving the existing controls.

The mock retains the requested note anchor and before/after intent. A held
window keeps its prefix and Fresh zero while its retained before span still
reaches raw top. Metadata-only prefix changes do not manufacture Fresh notes.
No strings, CSS, layout or new interface control are added.

## Language arrays

Every entry in the existing language array participates in an OR. Order and
duplicates do not change membership; absent and empty arrays add no filter.
The internal scalar language fallback remains available to native callers.

Each language uses the existing exact language-label match. English and
Japanese additionally use the existing removable script heuristic; a mixed
note can match both. This is not general language recognition. Native query,
window and time-rail membership use the same predicate.

## Frontend proof

The source originals and hashes are retained in
`tmp/search-before/manifest.json`. Controlled frontend proof restored those
actual files, ran the new tests, and restored the candidate in a finally block.

At 16:11:16 UTC the corrected fixtures produced six failing regressions and one
passing stale-key control on the originals (0.716 seconds, load 1.43/1.25/1.33).
The candidate passed all seven at 16:11:17 UTC (0.665 seconds, load
1.56/1.28/1.34). Exact note budgets, prefix order, mute exclusion, held arrivals,
retained-before behavior, time counts and language union are asserted.
An initial attempt exposed existing fixture notes matching the test word;
the existing since filter now isolates the fresh test notes without relaxing
their count assertions. Both initial attempts remain in the proof directory.

Full web check passed at 16:13:24 UTC in 6.275 seconds, starting load
1.66/1.52/1.43. Earlier attempts caught test-only type narrowing and formatting.
Node syntax checks passed for the new real Worker helper and harness hook.

Evidence in the isolated Search worktree:
`tmp/search-web-proof/{before-try2,after-try2,check-try3}.{json,log}`.
The combined source e7eebb72 passed the seven contract/authorization Node cases
at 16:33:43 UTC (0.214 seconds). Its full web check passed at 16:33:51 UTC
in 7.227 seconds, load 0.86/2.23/2.57 to 1.60/2.36/2.61. Combined evidence is
`tmp/variants-{node-preflight,web-check}.{json,log}`. No native or Worker gate
was run during this source-only integration.

## Native and Worker proof

Native cases in `engine_search_language_test.rs`, `engine_search_people_test.rs`
and `engine_search_private_test.rs` cover language union, person matching/rank,
public/private mute ownership, hidden revocation, prefix changes, anchors,
retained-before capacity, exact note budgets, Fresh and time-rail counts.

On 2026-11-16, the original Search commit's twelve production Rust hunks were
reversed while retaining those tests and the later auth, emoji, private-list
and history changes. All eleven tests failed as assertions after a fresh
compile. Restoring the candidate made all eleven pass. An unrelated compile
failure or a cached old binary did not count as evidence.

| Check | UTC start | Seconds | Load 1/5/15 at start |
| --- | --- | ---: | --- |
| Native before: 11 expected failures | 18:04:59 | 10.428 | 1.76/2.08/2.72 |
| Native after: 11 passes | 18:05:19 | 6.871 | 1.62/2.02/2.68 |
| Selector workload command | 18:05:55 | 13.528 | 1.34/1.92/2.62 |
| Strict Clippy after test annotation | 18:07:38 | 1.354 | 1.40/1.80/2.50 |
| Worker WASM check | 18:07:47 | 4.161 | 1.77/1.87/2.52 |
| Before harness/helper freeze | 18:08:42 | 30.150 | 1.36/1.75/2.44 |
| After harness/helper freeze | 18:09:22 | 29.738 | 1.28/1.70/2.40 |

The first strict Clippy attempt rejected the fixture helper's intentional
unknown-patch panic. Commit 33a23b4a adds only its test-specific lint allowance;
the assertion and runtime are unchanged. The failed attempt remains recorded.
The native before/after source was 19bca1ee; frozen harness source is 33a23b4a.
Every Cargo command hashed and refreshed owned Rust/manifests to prevent stale
shared-target reuse. Each before overlay restored only its saved source files.

The workload prepares 2000 signed profiles, then times 25 uncached selector
calls: 615258 microseconds total, or 24.610 milliseconds per call. Preparation,
signing, compilation, JSON row projection and browser rendering are outside
that inner timer. This is a debug-build observation on the shared host, not a
release/browser latency claim or a speedup over the old absent selector.

The finite real Worker proof used copied harness WASM, loader, fixture helper
and JavaScript dependencies, fresh browser data, and a fresh loopback port.
The Worker blocked external fetch/socket traffic and relay publications.
At 18:10:40 UTC the before package delivered two verified notes with their
accepted profile, but no matching person prefix; the controlled failure took
15.302 seconds at load 1.27/1.62/2.31. A bare timeout was insufficient to pass
the negative-proof driver. The raw negative report remains `ok: false`.

At 18:11:32 UTC the corrected package passed all seven checks in 0.671 seconds,
load 1.08/1.49/2.23: two-note quota plus people, time-rail counts/positions,
current person anchoring, held Fresh, both language orders and Japanese-only.
Both runs had no page/Worker errors, overflow or publications. Worker, browser,
sockets, server and owned-process cleanup completed. These are harness-enabled
Worker bytes; required production/default integration gates remain pending.

Immutable package identities:

```text
before WASM 99194d3ce482deb7359c34e20f0294545f1e79204c992322ca05c4838076dd4d
after  WASM 577c049a84b3d3a47b3ea2ac7899012cc813cf98f11b0c5bcd931982e1352950
helper      3c9fff8aac296946a5fc123a15bdb472c1cccce16a6c85d205beab453936ca2f
```

Evidence is in the combined worktree's `tmp/search-proof`: `overlay.json`
binds the exact reverse patch; each dated phase retains command/source/load
records and logs; each `freeze-*` directory contains `frozen.json` and copied
bytes. Each `worker-*` directory keeps the finite verdict and cleanup report.
The existing `scripts/engine-search.mjs` cases also run in the main Worker
harness at the end of `engine-rich.mjs`, before time-rail checks.
