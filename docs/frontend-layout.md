# Note fitting and layout work

## Purpose

Keep the existing note appearance and reading choices while avoiding a layout
flush between each new note's overflow measurement.

## Measured cause

The frozen production artifact from `541e4a1e` had multi-second scroll delays in
the 2026-11-16 public hour. A separate profiled read-only run at
13:32:52-13:34:23 UTC used the same 156-follow public account and production
bytes. Load was 0.97/1.53/1.76 at start and 3.13/2.08/1.94 at finish.

That run rendered 2016 notes in 80.811 seconds. The longest polling step was
7.354 seconds: 6.745 seconds elapsed before its page evaluation entered, while
the evaluation's DOM work took 3.7 ms. A row/patch handler reached 480.2 ms;
the added observer took at most 1.6 ms. The full 80.853-second page CPU sample
attributed 22.439 seconds to `fold()` in `note.ts`, 5.960 seconds to
`insertBefore`, and 4.515 seconds to `getBoundingClientRect`. These sampled
costs include browser work charged to the calling JavaScript frame.

The timeline stream reached its 32 MiB limit and is incomplete. The CPU profiles
cover their full interval. The earlier network witness's own completeness flag
is insufficient: it predates the startup barrier and counter crosscheck. No
received-note completeness claim follows from that capture. The public account
was read-only and had no signer. No further public run was made for this change.

Artifacts are in `tmp/public-scroll-profile-tpahUH` in the canonical worktree:
`report.json`, `profile-summary.json`, `cpu-grouped.json`, and
`witness-qualification.json`. This is separate from the completed hour's evidence.

## Change

`createRowList` marks all newly fitted nodes before measuring them. `fitNotes`
then measures their text overflow as a group before inserting any fold control.
It runs synchronously before the draw returns, so the reading-position keeper
still sees the completed geometry. Existing nodes do not get fitted again.

Time-rail views have stable line widths and use the batched path. A native view
also batches when the sum of its direct notes' in-flow avatar heights exceeds the
view height by more than one pixel: folding cannot remove those columns, so the
scrollbar cannot disappear. The geometry check stops once that lower bound is
proved. Nested quotes, hidden notes and revealed wrappers do not inflate it.
Uncertain native views remain sequential because hiding a folded link card can
change scrollbar width and another note's line wrapping. Single-note reveals
still use `fitNote`; unfolded text, warning choices, fold-button behavior, DOM
structure, CSS and both string tables are unchanged.

## Regression and before/after measurements

The focused row-list test failed on the old code because each overflow read saw
earlier fold controls already inserted. The original three cases cover batching,
short/unfolded/already-fitted rows and the native-scrollbar fallback. Existing
note redraw and reading-choice tests also pass.

The real Chromium loopback check draws actual row-list code with product styles
and synthetic notes. It asserts `Performance.LayoutCount`, not a wall-clock
threshold. At both 720 px and 320 px, 120 notes produced 242 layouts before and
four after; unchanged draws produced zero. Complete DOM hashes and all row
heights/order matched before and after.

A paired replay of frozen bundles used the same 2000 generated long notes at
720 px. It ran 13:54:36-13:54:39 UTC at load 1.94/2.80/3.00 to
1.95/2.79/2.99. These are synthetic row-list measurements, not public relay latency.

| Counter | Before | After |
| --- | ---: | ---: |
| Draw elapsed ms | 1569.8 | 653.8 |
| Layout count | 4002 | 4 |
| Layout duration ms | 1224.926 | 346.567 |
| Style recalculation count | 2001 | 2 |
| Style recalculation duration ms | 140.402 | 139.142 |

The two complete DOM hashes both equal
`1af4125db3846d80426cc92edb6f9c74925478a0bd011e314679cc3cf5c4def9`.
All 2000 row heights and their order matched. The earlier unpaired measurements
had different host loads and are retained as evidence, not used for a speed ratio.
See `tmp/layout-tree/tmp/note-layout-paired-comparison.json` in the canonical
worktree for the exact frozen bundle and report paths.

## Native-scrollbar follow-up (2026-11-16)

The sixth frozen public run used a native-scrollbar Home. It did not exercise
the time-rail batching above. The added unit regression fails on the unchanged
native path, with seven controls passing; the correction passes all eight.
The actual Chromium fixture now checks both paths at 720 and 320 px, with
Playwright's scrollbar-hiding argument removed. A separate short-view case proves
that hiding a link card still removes the 14 px scrollbar without changing its
result. Every final DOM hash, row height/order and boundary result matches.

For 120 notes, native layout counts fall from 242 to four at both widths; the
rail remains four, and unchanged redraws remain zero. A 2000-note native draw
at 720 px falls from 4002 layouts to four. Before ran at 17:36:55-17:36:57 UTC,
load 2.67/3.28/3.59 to 2.54/3.25/3.58; after at 17:37:28-17:37:30 UTC,
load 5.20/3.88/3.78 at both ends. Elapsed draw times are 1675.6 and 773.9 ms,
with layout durations 1298.799 and 445.181 ms. Different shared-host loads mean
these elapsed values are diagnostic, not a public-scroll speed guarantee.
The complete 2000-row DOM hash is the same `1af4125d...` hash recorded above.

Full frontend check passed at 17:38:06-17:38:13 UTC in 6.764 seconds, load
4.40/3.84/3.77 to 4.65/3.91/3.80. Exact source, frozen bundles, reports and
comparisons are in `tmp/native-layout-tree/tmp/native-layout-proof/` in the
canonical worktree. The first fixture attempt kept Chromium's hidden scrollbar
and failed its boundary premise; it is retained separately, not counted as the
width-changing regression. All owned browsers and loopback servers were closed.

The default loopback regression is part of `web`'s `pnpm smoke`. To run it alone:

```sh
node web/scripts/smoke-note-layout.mjs
node web/scripts/smoke-note-layout.mjs --mode=native --rows=2000
```

Each run uses a fresh loopback port and browser context, blocks external requests
and all WebSocket constructors, and closes its browser/server in `finally`.
`LKJSTR_TEST_TMPDIR` can name a short temporary path inside the worktree when
Chromium's socket path would otherwise be too long. Reports and fixture bundles
remain under the worktree's `tmp/`; browser data is removed. No Rust build is used.
