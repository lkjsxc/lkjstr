# Engine lifetime and queue verification

## Purpose

Record the second 2026-11-16 engineering landing, including failed reproductions,
current-tree gates and their practical limits. The first shipped tree and its
gates remain in [engine-stream-verification.md](engine-stream-verification.md).
Public measurements remain associated with their exact frozen artifacts in
[engine-performance-hour.md](engine-performance-hour.md).

## Reproductions

The shipped Worker can answer a query immediately after successful account lock
with prior decrypted private-list entries. A loopback worker wrapper queues that
query as a microtask after the result, before any timer/status pass. Failed
account transactions preserve prior authorized data. The corrected commit path
purges revoked policy and replaces derived caches before acknowledging success.
A private mute word can also occur in a row anchor. The corrected policy removes
revoked anchors and rejects their replay while retaining public and ordinary
event-ID anchors. The final real Worker gate below includes this proof.

The shipped Worker also retains a pending loopback TLS upload after its existing
attachment is removed. The corrected queue/Worker confirms cancellation exactly
once, aborts owned HTTP/RPC work, releases its slot and ignores late results.
Focused browser coverage uses all three signer kinds, two clients sharing a
request name, Worker replacement, response-body stalls and processing polls.
The small fixture proves cancellation of pending socket/response work; it does
not measure intermediate bytes transmitted from a large request body. An upload
already accepted by a remote server is not remotely deleted by cancellation.

Initial private-view visibility now crosses the boundary atomically. Replay
sends page visibility before private openings, preventing transient signer work
while a conversation or its page is hidden. The browser fixture replaces the
dedicated leader, then checks unchanged conversation/before intent on showing.

## A failed combined gate

The first second-tree combined run failed after 283.4 seconds in an isolated
5000-note continuity fixture, after the new lifetime checks had passed. It
reached 4608 distinct rows instead of the requested next window. That run is
preserved in `tmp/second-before/`; it is not a passed gate.

A focused run of the exact frozen failing package subsequently reached all 5000
rows with zero drops/rejections, a 3240-event verification queue peak and a
551 ms maximum Worker tick. It ran 07:34:59-07:37:09 UTC for 129.939 seconds;
host load was 8.65/9.60/9.45 before and 6.88/8.39/9.01 after. Its raw trace is
`tmp/continuity-debug-bmfOIq/`. This confirms run-ahead under that workload,
not the precise cause of loss in the earlier run, whose drop counters were not
captured. A deterministic native reproduction separately tests pending
verification, explicit window advancement and overflow followed by EOSE.

## Subsequent diagnosis and current result

A second combined run failed at 4,672 rows after 253.333 seconds; its wrong-Worker
failure snapshot cannot establish queue loss. A frozen replay reached 5,000 rows,
but its 25th page took 14,898 ms against the unchanged 15-second assertion.
The retained diff performed quadratic unchanged-key scans on each 32-event slice.
The indexed correction preserves exact valid patch operations and bounds key
comparisons. See [engine-retained-diff.md](engine-retained-diff.md).

The ordinary rebuilt gate passed 338 checks with no page errors in 232.404
seconds, starting at 08:51:36.703 UTC. Its 26 history windows reached all 5,000
fixture IDs in 52.073 seconds. The slowest page took 5,568 ms. Both physical
IndexedDB snapshots contained all 5,000; final Worker counters had zero dropped
or rejected events and a verification queue peak of 200. The final visible
window was deliberately reduced after the completeness assertion.

An independent thread defect placed same-second or clock-skewed ancestors after
the focus. Three native cases fail before the relationship-order correction.
The normal rebuilt gate uses the original fixture; the frozen diagnostic's
clock adjustment is not enabled. See [engine-thread-order.md](engine-thread-order.md).

The exact normal package/report/trace is frozen in `tmp/second-after-fast/`.
Its WASM SHA-256 is
`c2c3d6655e0980a1c76cec10378854841bee5e1091478242317f989c25615ee3`.
This is the harness-enabled conformance binary. The production smoke binary is
separately identified by SHA-256
`ded9b5cd7d27a59966dc709afc1c22938f31980d653b59f1ef5e23a1502181c0`.
The public hour is an earlier, separately identified build; its two coverage
candidates have not been reclassified as confirmed per-event relay loss.

## Required gates

All rows below passed on 2026-11-16. Load is the shared host's 1/5/15-minute
average before and after each command. Four Cargo jobs and four test threads
were used. Documentation-only changes receive a final repo check before landing.

| Command | Start UTC | Seconds | Load before | Load after |
| --- | --- | ---: | --- | --- |
| `pnpm check:repo` | 08:46:41 | 0.702 | 9.60/10.06/8.73 | 9.60/10.06/8.73 |
| `pnpm test:quiet` | 08:46:42 | 103.400 | 9.60/10.06/8.73 | 10.40/10.88/9.20 |
| `pnpm rust-wasm:quiet` | 08:48:25 | 82.578 | 10.40/10.88/9.20 | 7.11/9.47/8.84 |
| `pnpm verify:quiet` | 08:49:48 | 67.692 | 7.11/9.47/8.84 | 6.18/8.75/8.63 |
| `pnpm --dir web check` | 07:28:32 | 7.457 | 15.09/11.02/9.59 | 15.32/11.13/9.63 |
| `pnpm --dir web build` | 07:28:39 | 0.417 | 15.32/11.13/9.63 | 15.30/11.20/9.66 |
| `pnpm --dir web smoke` | 09:07:40 | 381.798 | 8.41/7.72/8.22 | 3.64/5.70/7.24 |
| `sh scripts/engine-check.sh` | 08:51:36 | 232.404 | 5.22/8.13/8.43 | 9.72/10.13/9.30 |

The smoke includes the normal interface, 128 upload checks and offline shell
integrity/update/lifetime cases. Its first attempt stopped at Chromium launch:
the nested checkout's Unix socket path was too long. The corrected helper
retains a short caller path only when its real target is inside the checkout's
temporary directory. That failed attempt and its load remain in the record.

Earlier failed native attempts caught test-constructor fields and a shared
mutable test probe; both were corrected before the final rows above. They are
retained in `tmp/second-landing-gates-20261116.json`, not counted as passes.
The final normal conformance record is
`tmp/second-conformance-fast-20261116.json`; individual smoke/native logs are
named by that gate record.

## Limits and next verification

Public acquisition controls now record first receipt and query start/end.
The optional post-hour gap audit uses a fresh owned context, validates the
recorded process/path identity, and sends only read requests to at most three
responsive routes. Eleven ownership/guard cases passed. This tooling does not
retroactively add missing timestamps to the earlier hour.

No public relay received a test publication. All signer/send/upload fixtures
use fresh loopback origins and generated accounts. Browser and server processes
are reaped after success and failure. Shared host load remains a confounder
for wall-clock comparisons; the native complexity regression avoids timing
assertions. The next public hour is due after the third coherent main landing.
