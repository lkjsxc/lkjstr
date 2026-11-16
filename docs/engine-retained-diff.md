# Retained row diff cost

## Purpose

Record the retained-window slowdown, its operation-preserving correction, and
the difference between measured native cost and browser delivery evidence.

## Observation on 2026-11-16

The combined real-Worker conformance run started at 08:08:03.974 UTC and failed
after 253.333 seconds at the 24th retained-history step. It had passed 318
checks and reported no page errors. The previous retained list had 4,508 rows;
the next request required at least 4,698, but only 4,672 rows were observed
within 15 seconds. History requests reached `until: 1700100122`, not the final
fixture range. The harness uses 5,000 signed loopback notes with timestamp ties.

The 4,672 count is a multiple of the 32-event verification slice. That suggested
slow progress, but did not prove it: the original failure handler queried the
earlier contract Worker instead of the isolated continuity Worker. Its six-event
diagnostic snapshot cannot establish the failing Worker's queue or drop count.
No timeout has been relaxed in the product gate.

A frozen-package replay from 08:33:35.617 to 08:38:36.901 UTC passed 338
checks. Load was 7.55/5.83/6.30 before and 9.70/9.59/7.90 after. At about
4,700 retained rows, delivery advanced by 32 rows roughly every two seconds.
The 25th history wait took 14,898 ms, close to its unchanged 15-second limit.
Final diagnostics from the correct Worker reported 5,000 stored and verified
events, zero dropped or rejected events, a verification queue peak of 200,
and a 537.2 ms maximum core tick. This replay supports a delivery-cost
bottleneck; it does not establish the unobserved drop count of the earlier
failed run. The wire diff also runs outside the measured core tick.

The replay used a diagnostic-only strict timestamp fixture to get past an
independent same-second thread-order case. It did not contain this diff
correction or the subsequent relationship-order correction. Its package
SHA-256 was
`0966f7cebf14894f7afbe59d3e4b2137603b7aa0611c926eb6dc0fcbbbe3c3fa`.
Per-second row/store growth and request/EOSE/close records are preserved in
`tmp/next-tree/tmp/continuity-combined-20261116T083335Z/continuity.json`.

## Native reproduction

The exact pre-change `wire/output_diff.rs` was copied into an ignored native
proof crate, alongside the proposed implementation. The dependency is the same
`serde_json 1.0.150` used by this tree; release optimization is `opt-level=z`.
Fixtures have unique 64-character keys and representative typed note payloads.
Three measurements per case include construction of the resulting patch array.

The paired run was 08:27:24.292 through 08:27:38.157 UTC. Host load averages were
4.61/6.18/6.76 before and 5.47/6.30/6.79 after. The earlier isolated baseline
at 08:24:34 through 08:24:45 had load 5.01/7.34/7.19 to 4.98/7.26/7.16.

| Retained rows | Append 32: prior median ms | Corrected median ms | Prior removal scan ms |
| --- | ---: | ---: | ---: |
| 800 | 19.81 | 1.33 | 0.46 |
| 2,000 | 150.37 | 7.42 | 2.84 |
| 4,500 | 789.21 | 17.05 | 18.28 |
| 5,000 | 916.44 | 22.61 | 17.81 |

At 5,000 retained rows, the corrected append diff was about 40.5 times faster
in this native sample. Both implementations emitted exactly 32 insert
operations. Moving one row around the list and changing one payload took
772.62 ms before and 28.08 ms after at 5,000 rows; the established operation
sequence was preserved, including its 9,998 operations.

These are native diff timings, not end-to-end Worker, page or frame timings.
The removal scan column measures the old `windows.rs` ID membership loop in
isolation. It does not include row projection, count settlement, serialization
or transport. The corrected membership set has not been separately timed.

## Cause and correction

The old wire diff repeatedly scanned the entire target list to detect removed
keys, then searched the current order and old rows for each target row. Even a
32-row append performed quadratic key comparisons against thousands of
unchanged rows. This work ran again on each delivered verification slice.

The corrected diff uses a sorted map from key to stable slot index and a linked
order stored in a bounded temporary array. The original index still identifies
the old row for equality checks. Each order change updates predecessor and
successor indices directly. Reverse traversal emits the same removal, insertion
point and update sequence for valid unique string keys. Key lookup work is
O((old + next) log(old + next)); temporary memory is O(old + next).

The internal renderer also uses a sorted set of new IDs for removal membership,
replacing its separate quadratic scan. Row projection, visibility, numeric
patch positions and the frontend patch contract remain unchanged.

Malformed non-string keys or duplicate keys cannot be indexed unambiguously.
They take a deterministic full reset: remove each old row, then insert the
complete next array. This defensive path is outside the valid unique-string
row contract and does not silently treat malformed keys as distinct rows.

## Regression evidence

The native proof passed four cases and clippy with warnings denied:

- All 720 permutations of six rows, including value changes, removals and
  additions, produce exactly the previous operation array and final rows.
- Six hundred deterministic edit steps exercise insert/remove/move/update
  combinations across changing retained lists.
- Five-thousand-row append and reversal cases bound key comparisons by a
  constant times row count times its logarithm, without a wall-clock assertion.
  Its comparison counter is local to one invocation; no shared mutable probe
  state is required.
- Non-string and duplicate keys take the explicit full-reset path.

The registered tests live in `engine/wire/output_diff_test.rs`; the historical
algorithm is retained only in a test oracle. Run the focused tests with:

```sh
CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4 cargo test -p lkjstr-core output_diff::tests
```

The ignored proof and raw native measurements are in
`tmp/next-tree/tmp/retained-diff-proof/` under the stream worktree:
`before.rs`, `after.rs`, `tests.log`, `clippy.log`,
`before-timings.json`, and `comparison-timings.json`.
The copied source SHA-256 is
`5e32e912ddd3bf2b1ed2b81475d7bf1e8a3ddeb4da7b942f29ac99e2ef4a771e`.

## Current Worker measurement

The ordinary rebuilt conformance run started at 08:51:36.703 UTC, passed all
338 checks with no page errors, and took 232.404 seconds including packaging.
Host load was 5.22/8.13/8.43 before and 9.72/10.13/9.30 after. It did not enable
the diagnostic timestamp fixture. The measured WASM SHA-256 was
`c2c3d6655e0980a1c76cec10378854841bee5e1091478242317f989c25615ee3`.

Its 26 retained-history windows reached all 5,000 fixture IDs in 52.073 seconds,
from the first window wait to the final completion. The slowest page took
5,568 ms; the preceding page took 4,056 ms. Final diagnostics reported 5,000
verified and stored events, zero drops/rejections, a queue peak of 200, and
625.1 ms maximum core tick. Both physical snapshots contained all 5,000 IDs.
The final visible window was deliberately shrunk to 699 after the completeness
assertion; those omitted rows were not lost from the store.

The exact package, trace and report are frozen in `tmp/second-after-fast/`.
This is loopback Worker evidence, separate from the native diff ratio and the
public hour. It does not establish a 40-fold end-to-end or public-network gain.
