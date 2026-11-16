# Engine performance

## Purpose

Record runtime measurements and reproducible workloads. Synthetic index fixtures never enter the product or a public relay. Timing is elapsed wall
time on this shared Linux host, not a throughput promise for another device.

## Time-rail note fitting (2026-11-16)

The paired 2000-note Chromium draw at 13:54:36-13:54:39 UTC fell from 1569.8 to 653.8 ms and from 4002 to four layouts. Load was 1.94/2.80/3.00 to
1.95/2.79/2.99; complete DOM hashes and row heights matched. This is a finite local workload, not public relay latency. Source profile, regression and
limits: [frontend-layout.md](frontend-layout.md).

## Zap receipt projection (2026-11-16)

The bounded native target-index workload improved from 462.144 to 23.566 ms per 800 totals. Date/load, controlled before proofs and limits are
recorded in [engine-performance-zaps.md](engine-performance-zaps.md).

## Third-landing hour (2026-11-16)

The shipped build ran 12:13:43-13:13:43 UTC at sampled load 1.32/1.47/1.56 to 2.58/1.69/2.01: 2082 notes in 79.159 s, with a 12.358 s maximum scroll
step. One later-visible Home candidate remains unresolved; capped query evidence prevents a completeness claim. See [the full
hour](engine-performance-third.md) and [the bounded host observer](engine-performance-evidence.md).

## Retained-history follow-up (2026-11-16)

The normal loopback Worker gate at 08:51:36 UTC reached all 5,000 notes in 52.073 seconds; the slowest page took 5,568 ms and physical IndexedDB held
all 5,000 IDs. Load was 5.22/8.13/8.43 to 9.72/10.13/9.30. Exact artifacts and the separate native diff comparison are in
[engine-retained-diff.md](engine-retained-diff.md).

## Offline shell regression (2026-11-16)

The real packaged shell and six focused lifecycle/fault scenarios passed in 78.341 seconds including the JS-only rebuild. A load sample during that
run, 06:27:30 UTC, was 10.47/10.84/9.16. Chromium's first update after offline emulation accounts for about 60 seconds; this is a test duration, not
app startup. The same six focused cases passed again with worktree-local temporary profiles in 16.829 seconds. Both rollback/cache-growth regressions
fail on the original generator. Tests use explicit awaited polling: Playwright 1.65 treats an async waitForFunction predicate's Promise as truthy
without polling its resolved value. See [offline-shell.md](offline-shell.md) for cache bounds, evidence and limitations.

## Native index workload

`CARGO_BUILD_JOBS=4 cargo run --release -p lkjstr-core --example engine-bench` indexes 100000 events from 1000 authors, then runs 100 queries
selecting two sparse authors, 200 results each. It also serializes/hydrates 2000 recent events and builds 50 finished rows. This workload excludes
signature verification.

| Measurement | Before | After |
| --- | --- | --- |
| 100 sparse author queries | 3087.80 ms | 1.88 ms |
| Index 100000 events | 99.81 ms | 125.06 ms |
| Serialize 2000 events | 1.35 ms | 1.33 ms |
| Hydrate 2000 events | 1.85 ms | 1.99 ms |
| Build 50 rows | 0.077 ms | 0.081 ms |
| Serialized 50 rows | 36901 bytes | 36901 bytes |

The change merges existing author indexes using a heap instead of scanning unrelated events. A native equivalence test covers tied timestamps and
eviction. Insertion variance is reported rather than hidden; this optimization targets sparse queries. Raw measurements:
`tmp/engine-bench-before.json` and `tmp/engine-bench-after.json`. Repeated measurements are needed for distributions.

## Final native run

After the remaining engine changes: index 100000 events 111.60 ms; 100 queries 2.49 ms; serialize 2000 events 1.17 ms; hydrate 2000 events 1.78 ms; 50
rows 0.151 ms and 42251 bytes. Raw data: tmp/engine-bench-final.json. The 1.88 ms measurement above isolates the initial index change; 2.49 ms is the
final run.

## Worker harness

Source the repository-local cache environment (`tmp/env.sh` on this worktree), then run `LKJSTR_ENGINE_HARNESS=1 sh scripts/engine-build.sh` and `node
scripts/engine-harness.mjs`. The build uses the installed wasm-bindgen binary in the Trunk cache; override its location with `LKJSTR_WASM_BINDGEN`.
All outputs stay under ignored tmp/.

The browser harness uses a fresh loopback port and browser context. It adapts the existing fake relay to a real local WebSocket server because the
browser routing API does not intercept dedicated Worker sockets here. No upstream relay is involved. A native helper keeps its fixture signing key
in-process and emits public signed events only. It exercises actual structured messages, WASM verification, Worker IndexedDB, cache reboot, visibility
and NIP-07 delivery.

The harness build enables `harness`, exposing simulated time and the same index benchmark in WASM. Production builds omit these exports. Worker
results go to `tmp/engine-harness/report.json`; WASM timings go to `wasm-benchmark.json` there.

## Measured WASM run

Headless Chromium, release WASM: index 100000 events 106.80 ms; 100 sparse queries 4.00 ms; serialize 2000 events 3.40 ms; hydrate 2000 events 3.70
ms; 50 finished rows 0.50 ms, 42251 serialized bytes. Row size grew from the initial native baseline because author-name emoji segments were added.
These timings exclude IndexedDB and signature verification, as in the native workload.

## Runtime diagnostics

The diagnostics source exposes verification queue depth and high-water mark, stored count, accepted/rejected signatures, persistence queue, last/max
tick time, transaction duration, and per-relay received/sent/useful counts, request count, failures, last arrival and EOSE latency. These are actual
host timings and scheduler counters. No note bodies or local secret keys are included.

## Physical IndexedDB cold start

`LKJSTR_COLD_START=1 sh scripts/engine-check.sh` creates 100000 unique signed compact rows using a native in-process fixture key. A fresh Chromium
context seeds those physical rows, closes the database, then launches the actual Worker. It reads the newest 2000 through the index and verifies them
in bounded slices. No relay replay is used. Timings are reported without pass/fail thresholds.

Measured on 2026-11-14: seed 1501.3 ms; Worker ready after indexed read 40.2 ms; first visible rows 61.0 ms; all 2000 cached events verified 2001.5
ms. Physical row count was 100000 before worker launch. Raw report: `tmp/engine-harness/cold-start.json`. These are one-run measurements, not device
budgets or distributions. The independent in-memory benchmark excludes crypto and disk, and remains a separate workload.

Memory retains 16000 regular and 4000 replaceable events. Live committed writes prune disk to 20000 rows; the benchmark deliberately seeds an
oversized existing database and measures indexed boot without waiting for a subsequent live write.

## Read-only public-network measurements (2026-11-16)

`pnpm real:hour` builds the real release and native helpers, snapshots their hashes, and opens a fresh headless Chromium profile. It is outside
default gates. Only a public npub is imported. A before-execution REQ/CLOSE-only socket guard blocks publication and authentication; no owner account
or signing key is used. Worktree-local profiles and owned servers close on success or failure. Release asset bytes remain unchanged; reports and
public-only fixtures stay under `tmp/`.

Use `--account=<64-hex-public-key>`, `--relays=<comma-list>` and `--output=tmp/<name>` for repeatability. `--seconds=300 --scroll-notes=2000` is a
short archive check, never an hour. `--helpers=existing` skips recompilation. The default observes 3600 real seconds before network cuts, page/Worker
freezing, two-tab checks and a separate 20000-event physical cache boot. Current runs block service workers because Chromium cannot install the guard
before their initial execution here; public offline-shell behavior is excluded. See the independent service-worker smoke gate and [public measurement
details](engine-performance-public.md).

### Completed baseline, fixed short check and corrected hour

The baseline live hour ran 04:24:59.152-05:24:59.298 UTC, 3600.146 seconds, on `6830584c`; faults finished 05:38:24.055 UTC. First live load average
was 10.62/9.79/7.64, last 14.08/9.06/7.68; sampled one-minute load ranged 3.25-14.08. The fixed build ran 05:30:22.396-05:35:22.465 UTC, 300.069
seconds; first live load 7.97/7.75/7.47, last 6.79/7.25/7.37. These are individual shared-host runs.

| Measurement | Baseline | Fixed short run | Corrected hour |
| --- | --- | --- | --- |
| Signed-out Global DOM note / name / loaded avatar | 360 / 487 / 691 ms | 353 / 555 / 758 ms | 351 / 453 / 453 ms |
| Home after public npub import, reusing Global cache | 142 ms | 126 ms | 143 ms |
| Warm Home note / name / loaded avatar | 243 / 344 / 243 ms | 267 / 470 / 267 ms | 486 / 587 / 486 ms |
| Archive, 2000 requested | 808 notes in 126738 ms, stalled | 2031 notes in 65677 ms | 2004 notes in 51971 ms |
| Scroll polling step median / maximum | 610 / 835 ms | 617 / 916 ms | 614.5 / 1025 ms |
| Physical IndexedDB event rows, first / last | 32 / 3855 | 32 / 8373 | 32 / 9929 |
| Browser storage estimate, first / last | 75864 / 7492046 bytes | 69759 / 10651582 bytes | 71816 / 12332596 bytes |
| Engine sockets / tracked requests maximum | 8 / 32 | 8 / 32 | 8 / 32 |
| rAF intervals over 34 / 100 ms | 365 / 186 | 224 / 89 | 407 / 179 |
| Longest rAF interval | 350 ms | 383.4 ms | 683.2 ms |

DOM timestamps use 100 ms polling and loaded image dimensions, not compositor paint timestamps. Scroll steps include intentional 600 ms waits. The
fixed run observed 69 new-row batches: median wait 663 ms, maximum 2148 ms. Frame intervals cover 213265 baseline and 16501 fixed live observations;
they do not directly count dropped display frames. No page errors or forbidden outbound frames arose. The initial request counter can retain
relay-CLOSED IDs until client CLOSE; current probes remove them immediately. Its maximum is a client-tracking bound.

The archive stalled 45 seconds without an end state. Diagnostics kept healthy Azzamo and failed Damus in the two focused read slots while permitted
readers were connected. Three history regressions failed before fixing failed-route vetoes and partial-answer cursors; two read-fallback regressions
also failed. Healthy routes now advance independently, unknown routes retain their original span, and unavailable routes release ordinary read slots
without granting write relays read permission. Seventeen focused paging/recovery/stability tests passed. The fixed public archive reached the
requested depth; network samples differ.

### Memory attribution and recovery

Baseline page JS heap first/last/min/max was 4.58/13.32/4.58/37.55 MB; embedder heap 25.50/183.73/25.50/365.33 MB. Worker JS heap reached 41.99 MB,
but the observer retained 33.48 MB of serialized repeated query evidence. That number cannot establish product memory growth. Baseline WASM linear
memory was not sampled. The fixed short run sampled Worker linear memory 3.54-67.04 MB while its cache grew; five minutes cannot establish a long-run
bound. Values are unforced-GC snapshots, not process RSS. Corrected probes intern query payloads, cap retained evidence, and label completeness
unknown if evidence is dropped.

Baseline network cuts lasted 30.421 and 604.587 seconds; a subscribed relay socket returned 3020 and 1510 ms after resume. Page-only freezing lasted
30.007 seconds with the SharedWorker still active; its 2 ms recovery is not engine wake. First-tab close preserved SharedWorker connectivity in 90 ms;
a separate dedicated-Worker leader replacement took 509 ms. Physical 20000-event seed took 730.6 ms; first profile note appeared 332 ms after
navigation.

A separate fixed-build engine pause ran 05:57:18-05:57:55 UTC at load 5.91/6.85/7.40 to 7.28/7.08/7.46: actual engine Worker debugger pause 30.051 s,
page freeze 30.002 s, Worker clock gap 30.098 s and subscribed recovery 3062 ms. Only owned sockets/HTTP were cut. This scoped suspension is not
host/OS sleep.

The baseline and short source-route controls did not establish a missed note, but returned few or zero eligible events and included failed relays.
They do not prove completeness. Startup-only routes and broader relay coverage are reported separately in the linked audit, including corrections to
the original thread probe. The fixed short run encountered two service-worker inspection timeouts; its engine/DOM archive measurements remain separate
from unsupported shell instrumentation. Both failed pause attempts are preserved.

The corrected hour ran 05:58:06.401-06:58:06.489 UTC, 3600.088 seconds; faults finished 07:12:16.292. Load was 7.25/7.07/7.45 to 8.82/9.48/9.89, with
one-minute range 3.11-17.76. Worker JS first/last/max was 1.143/8.813/8.858 MB; page JS 4.739/13.981/36.813 MB. WASM reached 65.274 MB at +52.125 s
and stayed flat. The bounded observer still contributes memory; this is not an indefinite bound. Home controls found five eligible notes, three
observed and two coverage-gap candidates after a healthy fallback was replaced. A native regression reproduces that route transition. The ten-minute
recovery has one verified delivered-note witness. Full ranges, dates, controls, fault timings and limits are in [the corrected hour
audit](engine-performance-hour.md); raw data remain in `tmp/real-hour-20261116-corrected` against the exact frozen artifact documented there.
