# Engine performance

## Purpose

Record runtime measurements and reproducible workloads. Synthetic index fixtures
never enter the product or a public relay. Timing is elapsed wall time on this
shared Linux host, not a throughput promise for another device.

## Native index workload

`CARGO_BUILD_JOBS=4 cargo run --release -p lkjstr-core --example engine-bench`
indexes 100000 events from 1000 authors, then runs 100 queries selecting two
sparse authors, 200 results each. It also serializes/hydrates 2000 recent events
and builds 50 finished rows. This workload excludes signature verification.

| Measurement | Before | After |
| --- | --- | --- |
| 100 sparse author queries | 3087.80 ms | 1.88 ms |
| Index 100000 events | 99.81 ms | 125.06 ms |
| Serialize 2000 events | 1.35 ms | 1.33 ms |
| Hydrate 2000 events | 1.85 ms | 1.99 ms |
| Build 50 rows | 0.077 ms | 0.081 ms |
| Serialized 50 rows | 36901 bytes | 36901 bytes |

The change merges existing author indexes using a heap instead of scanning
unrelated events. A native equivalence test covers tied timestamps and eviction.
Insertion variance is reported rather than hidden; this optimization targets
sparse queries. Raw measurements: `tmp/engine-bench-before.json` and
`tmp/engine-bench-after.json`. Repeated measurements are needed for distributions.

## Final native run

After the remaining engine changes: index 100000 events 111.60 ms; 100 queries
2.49 ms; serialize 2000 events 1.17 ms; hydrate 2000 events 1.78 ms; 50 rows
0.151 ms and 42251 bytes. Raw data: tmp/engine-bench-final.json. The 1.88 ms
measurement above isolates the initial index change; 2.49 ms is the final run.

## Worker harness

Source the repository-local cache environment (`tmp/env.sh` on this worktree),
then run `LKJSTR_ENGINE_HARNESS=1 sh scripts/engine-build.sh` and `node scripts/engine-harness.mjs`.
The build uses the installed wasm-bindgen binary in the Trunk cache; override
its location with `LKJSTR_WASM_BINDGEN`. All outputs stay under ignored tmp/.

The browser harness uses a fresh loopback port and browser context. It adapts
the existing fake relay to a real local WebSocket server because the browser
routing API does not intercept dedicated Worker sockets here. No upstream
relay is involved. A native helper keeps its fixture signing key in-process
and emits public signed events only. It exercises actual structured messages,
WASM verification, Worker IndexedDB, cache reboot, visibility and NIP-07 delivery.

The harness build enables `harness`, exposing simulated time and the same index
benchmark in WASM. Production builds omit these exports. Worker results go to
`tmp/engine-harness/report.json`; WASM timings go to `wasm-benchmark.json` there.

## Measured WASM run

Headless Chromium, release WASM: index 100000 events 106.80 ms; 100 sparse
queries 4.00 ms; serialize 2000 events 3.40 ms; hydrate 2000 events 3.70 ms;
50 finished rows 0.50 ms, 42251 serialized bytes. Row size grew from the initial
native baseline because author-name emoji segments were added. These timings
exclude IndexedDB and signature verification, as in the native workload.

## Runtime diagnostics

The diagnostics source exposes verification queue depth and high-water mark,
stored count, accepted/rejected signatures, persistence queue, last/max tick
time, transaction duration, and per-relay received/sent/useful counts, request
count, failures, last arrival and EOSE latency. These are actual host timings
and scheduler counters. No note bodies or local secret keys are included.

## Limits of these numbers

The 100000-event benchmark measures indexing and query costs in memory. It does
not prove cold IndexedDB startup at 100000 physical rows. The Worker loads only
2000 recent rows by its created_at index and verifies them incrementally. A
large-database browser startup benchmark remains required. The memory cache is
bounded independently to 16000 regular and 4000 replaceable events.
