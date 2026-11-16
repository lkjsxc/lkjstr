# Historical route continuation

## Purpose

Record the bounded fix and evidence for a full historical route lost during
quality reranking at its inclusive cursor. No interface or protocol change is
required. The native defect is proven; actual Worker checks are pending.

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

The ongoing sixth public run stopped below 2,000 distinct Home note IDs and
reported exhaustion. Its last recorded historical route change is compatible
with this defect, but per-request receipt counts are still needed to attribute
that observation. No public query, browser inspection or frozen-run mutation
was added by this native proof.

Finite Worker checks against the unchanged 1c0 production bytes and a corrected
package, merged required gates and post-change public measurement remain pending.
