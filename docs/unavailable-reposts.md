# Unavailable reposts and ordinary note windows

Updated: 2026-11-16. The corrected native cases pass. Corrected Worker proof,
required combined gates, real interface smoke and deployment remain pending.

## Purpose

Keep ordinary note windows and counts consistent while retaining the raw relay
history and finite target requests needed to resolve an unavailable repost.

## Reproduced failure

The combined Worker gate failed its first Search note-budget assertion:
three matching verified notes were in the time index, but the two-note window
contained one note and one person. Reopening the same two-note window retained
one note; requesting three slots produced two notes. The same Worker bytes
passed all seven Search checks with a fresh store.

An unresolved kind-6 wrapper was admitted by the ordinary query. It consumed
a native row slot before the wire adapter discarded the unrenderable wrapper.
Its raw position also inflated Fresh and reduced retained backward capacity.
The window implementation was unchanged from the last confirmed shipped
source, `541e4a1e`; this is an existing engine defect, not a people-row quota.

The repeated full-context failure used frozen WASM:

```text
d0190ae85b266cfa8dfc4b50eaf4848c5c85811eae86b894ec422427432beb9c
```

At 19:11:30 UTC, load 1.16/1.13/1.32, the bounded replay took 181.246 s.
It retained the original failure and recorded the two re-window observations.
There were no page errors or owned processes after cleanup.
Evidence: combined worktree `tmp/search-stream-proof/main-replay2`.

## Corrected policy

Only ordinary Home, Global, Their Home, Search, Hashtag and Relay note feeds
withhold unavailable wrappers. Notification and explicit profile activity
projections retain their existing behavior.

The native selector retains a contiguous raw span for relay history while
counting note quota, backward capacity, Fresh and the top boundary without
unavailable wrappers. The native right quota remains `after + 1`; it does not
shrink to the number of notes already cached. History refill compares against
this same quota and retains its original relay cursor.

Adjacent unavailable wrappers stay in the raw span when the first note is
anchored. Their target requests remain owned while the note stays in place;
late target arrival adds the correct Fresh count without moving that anchor.
Signed-out Global ignores wrappers before its author and duplicate limits.
Unavailable authors and wrapper count streams are not hydrated as note rows.

A separate demand admits at most 120 distinct, valid, missing final `e`
targets from the selected raw span. It does not consume the existing visible
quote-reference budget. Muted wrappers and invalid targets create no demand.
Closing or hiding the view releases the demand through the existing planner.
Target arrival re-runs the original query predicate; a nonmatching Search
target is excluded.

This is a finite window demand, not an exhaustive repost resolver. More than
120 distinct unavailable targets in one unchanged span remain outside that
target batch until the window or its candidates change. The wire still has no
unavailable-repost placeholder. No complete target-availability claim is made.

## Native evidence

A fresh build at 19:26:19 UTC, load 1.07/0.98/1.12, reproduced four assertion
failures in 1.531 s: quota, Fresh, backward retention and wrapper count demand.
The staggered note/profile-arrival control passed. The first corrected build
passed those five cases and 22 adjacent cases in 7.803 s at 19:33:31 UTC,
load 0.89/0.92/1.05.

An additional anchored-target control failed before the raw-start correction;
the Global author-cap and distinct-target-budget controls passed. The final
eight targeted cases passed in 2.472 s at 19:39:11 UTC,
load 1.45/1.01/1.03, with source hashes unchanged and no owned processes left.
They cover late target arrival, muted targets, malformed references, duplicate
target IDs, the 120-target bound and preserved visible quote demand.

Cases: `engine_search_stream_test.rs` and
`engine_unavailable_repost_test.rs`. Logs, exact source manifests, dates and
loads are in `tmp/search-stream-proof/native-*` in the combined worktree.
Two earlier fixture-authoring errors are retained there: a malformed Hint
object and an invalid Rust format placeholder. Neither is counted as evidence
of a product failure.

## Deterministic Worker failure

The loopback Search fixture now first retains one valid empty-content repost
through a profile/reposts subscription, before adding its matching notes.
The target is absent. The immutable pre-fix run established exactly one new
verified event and one new stored event during that warmup.

At 19:37:52 UTC, load 0.80/0.88/0.99, the original first Search wait failed with
one person and one note, with none of the seven original assertions reached.
The profile on the note was verified. Worker duration was 15.510 s; total
owned runner lifetime was 15.782 s. No page/Worker errors or publications
occurred. Worker, browser, sockets, server and owned processes were reaped.

Evidence: package-audit worktree
`tmp/search-repost-proof/before-20261116T193752Z`.

```text
manifest 04ae8a7a24258924ec5f4c7ceef3a2ebea6aee4a3e70c9467ea800c4899a7878
report   f4268ff636b0c8b5fe18d808d83fecba18a1b6b659f29c69224aaede165f946c
```

The original seven note-budget, people, anchor, Fresh and language assertions
remain unchanged. Corrected frozen bytes and the full combined gate must pass
before landing.
