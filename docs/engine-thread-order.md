# Thread ordering proof

## Purpose

Record the relationship-order defect found during the 2026-11-16 combined
Worker check, its native regression, and the separate continuity diagnostic.

## Observed defect

The frozen Worker returned a same-second channel reply before its parent.
Both rows had the correct channel and thread roles, but their shared timestamp
left the event ID to decide the displayed order. The failing assertion was
`notification thread shows exchange without channel creation ancestor`.

The affected path was `Store::thread` chronological ordering, retained by
`engine/query.rs` and rendered in that order by `web/src/views/feed-draw.ts`.
The thread role controlled appearance and focus scrolling; it did not repair
array order. A parent's clock being ahead caused the same problem without an
ID tie. The design requires answered notes above the focused note.

The original frozen failure is retained at
`tmp/continuity-combined-20261116T082509Z/report.json`.
It used the same package as the earlier pressure failure:

```text
0966f7cebf14894f7afbe59d3e4b2137603b7aa0611c926eb6dc0fcbbbe3c3fa
```

## Change and native proof

`engine/thread.rs` now derives the ancestor chain before filtering or
windowing. The chain is projected oldest ancestor first, then the focus.
Replies keep their prior timestamp and event-ID ordering and their existing
depths. Cached roots across missing parents remain supported. The existing
visited set bounds cycles and prevents a second copy of the focus.

`engine_thread_order_test.rs` adds four cases:

- Clock-skewed ancestors and focus, retaining chronological reply order.
- Same-second channel replies with IDs both below and above the parent.
- A cached root across a missing parent despite clock skew.
- A synthetic cached cycle that terminates without duplicate rows.

The first three cases compiled and failed before the change. Afterward, all
four new cases and six existing thread/channel cases passed. Targeted clippy
also passed with warnings and unwrap, expect, and panic usage denied. Signed
fixtures use fresh generated keys; the cycle case explicitly bypasses
signature admission to test the projection guard.

Evidence is in `tmp/thread-order/before.log`, `after.log`, `clippy.log`, and
`evidence.json`. The initial fixture compiler error is retained separately as
`before-compile.log`; it is not the failing-before proof.

## Continuity diagnostic scope

The diagnostic-only branch `LKJSTR_CONTINUITY_DIAGNOSTIC=1` makes the incoming
channel reply later than its parent and waits until that time before sending
it. This allows the unchanged frozen package to reach the continuity test.
The ordinary conformance path does not set that branch. It does not prove the
thread fix or replace the normal rebuilt gate.

The completed diagnostic is retained at
`tmp/continuity-combined-20261116T083335Z/`. It passed 338 checks with no page
errors in 301.80 seconds. Every one of the 5,000 fixture IDs was sent; final
Worker diagnostics reported 5,000 verified and stored, no dropped or rejected
events, and a verification queue peak of 200.

Rows and stored counts advanced by 32 roughly every two seconds near the end.
Sampled page starts put page 24 near 13.4 seconds and page 25 near 15 seconds,
against the unchanged 15-second assertion. These are sampled intervals,
including inter-page check overhead. They support a throughput problem and do
not erase the earlier timeout. The maximum measured core tick was 537.2 ms;
that timer does not include all wire-output work in the Worker pump.

The immediate physical IndexedDB snapshot contained 4,968 events. The later
Worker diagnostic had all 5,000 in memory, but that run did not take another
physical snapshot. It therefore does not establish final durable completeness
for the last 32 events. The follow-up capture records exact page completion
times and a second physical snapshot after diagnostics. Exact current queue
bytes are absent from the frozen wire diagnostic and are not inferred as a
measurement.

`tmp/continuity-pressure-analysis.json` contains the derived measurements and
these limits. Original reports, logs, fixtures, and packages remain unchanged.
The normal rebuilt conformance gate is a separate required check.

## Normal rebuilt gate

The corrected Worker passed the ordinary 338-check conformance run on
2026-11-16 at 08:51:36 UTC, with no page errors and no diagnostic fixture flag.
It includes the original same-second thread assertion. Its separate continuity
trace reached all 5,000 IDs and verified all 5,000 in physical IndexedDB.
See [engine-retained-diff.md](engine-retained-diff.md) for its exact package,
timings and host load; it does not change the frozen replay's earlier limits.
