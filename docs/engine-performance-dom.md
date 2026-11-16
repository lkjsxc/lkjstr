# DOM membership evidence

## Purpose

Keep transport receipt, wire projection, physical cache presence and actual
source DOM membership separate in the optional public measurement. This changes
only measurement scripts. Product layout, words, CSS and protocol stay unchanged.

## What is observed

The page witness accepts connected direct children matching
`.body.own[data-view] > .view.feed[data-kind] > .list > .note[data-note]`.
The note identifier must be 64 lowercase hexadecimal characters. There must be
one mounted view and one observed open query for the source, bound to the fixed
public account installed by the harness. Home and notifications use their exact
tab names. A thread also pins its focus identifier. Scope changes or ambiguous
ownership remain unknown instead of combining different readers.

A quoted card, nested fake note, target excerpt, other source tile, disconnected
node or wire-only packet cannot satisfy this witness. The source is inferred from
existing window-manager/feed ownership; no product attributes or controls change.
A valid empty mounted list can establish attribution without inventing any row.

`seen` and `wireFirst` remain wire-projection evidence. `dom.first[source][id]`
records first observed membership in that source's direct row container. Removal
and reinsertion preserve the original timestamp. DOM membership does not imply
that the row was within the viewport, its warning cover was opened, or a compositor
paint occurred. Timestamps come from MutationObserver delivery or an explicit
pending-record flush. A delayed callback can observe an already-inserted node
past a cutoff; this is a latency/reproduction candidate, not proven late insertion.

## Bounds and lifetime

The witness covers only Home, notifications and the inspected thread, with at most
40,000 identifiers per source. Reaching the cap marks saturation; additional
identifiers increment a dropped counter. Query ambiguity, account/focus changes,
unsupported structure and missing instrumentation leave bounded sticky reasons.
A captured snapshot without the witness remains unknown after later valid
snapshots. The empty initial accumulator and installed but inactive thread scope
are not instrumentation failures.

The observer examines added subtrees and relevant identity/owner attributes. It
performs no layout mutation and does not retain DOM nodes between callbacks.
First-time maps and small scope summaries remain until page disposal; the explicit
stop hook disconnects observation and marks further evidence unknown. Per-minute
memory figures include these bounded probes. This capture must not be treated as
uninstrumented product memory or compared without accounting for changed probes.

## Cutoffs and interpretation

The main comparison uses first observed DOM membership by the live-hour cutoff.
Wire first receipt, exact physical-cache payload at the audit, and first DOM
observations during control-query grace are recorded separately. A complete host
network record can replace lost query logs; it cannot repair missing, saturated
or ambiguously attributed DOM evidence.

The end snapshot retains the requested window, latest Fresh wire count/time,
DOM Fresh pill state and scroll position. A non-top anchor or deliberately buffered
Fresh rows can explain missing DOM membership. No extra Fresh click is introduced
after the live cutoff. Every absent eligible note still requires route, buffering,
verification and anchor investigation before calling it an engine loss.

Notifications compare only direct kind-1 mention/reply notes. Grouped reaction,
repost and zap constituent identifiers remain outside the comparison. Thread
controls use the exact focus tag, an event-time cutoff at control start and native
eligibility; deeper replies without that focus tag remain outside scope.
The outage companion ends DOM capture before its independent direct controls and
makes no post-control DOM grace claim. Its socket recovery time is still not a
note-delivery recovery time.

Zero eligible controls, no successful control route, changed follow membership or
missing observation counters remain uninformative/unknown. These bounded samples
do not establish global relay completeness or indefinite memory stability.

## Verification

The finite `node scripts/real-hour-dom-proof.mjs` uses actual Chromium, an owned
loopback server and fresh data, with no public network. Its 12 groups cover the
wire-only counterexample, top-level insertion, nested quote/other tile/detached
exclusion, stable first time on reinsertion, wire-before/DOM-after cutoff,
saturation/drop, ambiguous queries/views/account changes, thread focus and stop.
The original 2026-11-16 proof is retained in
`tmp/dom-evidence-proof-Xpak83/report.json`; it passed in 0.515 s at load
0.99/1.28/1.59. The previous wire-only criterion incorrectly counted its unseen
wire-only note. The final source-bound rerun passed all 12 groups at
2026-11-16 16:13:51 UTC in 0.508 s, with load 1.39/1.48/1.42 to
1.75/1.56/1.45. Its executed-function/module hashes and cleanup are in
`tmp/dom-evidence-proof-mTEFKI/report.json`; both runs had zero external requests
and page errors and removed all owned browser data/listeners.

The observer, network-evidence, ownership and shared protocol Node checks pass
27 cases, including cutoff/grace separation and the inability of complete host
capture to repair missing DOM observation. The earlier quote-only VM proof remains
in the canonical `tmp/sixth-recorder-quote-proof.json`. No public hour has yet run
with this witness; the next full measurement must record its own exact source,
helper and real-build copies.
