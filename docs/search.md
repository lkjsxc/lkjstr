# Search contract and retained people

## Purpose

How the existing Search and language-filter contract is projected by core,
which data it can use, and what has actually been verified.

## Status

This source candidate is integrated with remote-signer authorization and emoji
sets on the sixth landing, 37b14ab5. Combined frontend preflight passed on
2026-11-16. Native compilation, native regression proof, the selector workload,
real Worker conformance and required combined landing gates are still pending.
This document does not claim a shipped change or public search completeness.

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

## Verification

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

Native cases are authored in `engine_search_language_test.rs`,
`engine_search_people_test.rs` and `engine_search_private_test.rs`.
The ignored `retained_directory_selection_workload` prepares 2000 signed
profiles and times 25 selections. It has not run.
`scripts/engine-search.mjs` is prepared for loopback real Worker evidence,
with a fresh fixture author, a two-note window over three cached notes,
language alternatives, calendar counts and person-header anchoring.
No native, WASM, real-build, browser or public-network result is claimed here.
