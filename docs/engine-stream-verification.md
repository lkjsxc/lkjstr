# Engine stream verification

## Purpose

Record the completed 2026-11-16 integrated-tree gates and their limits.
Public network measurements are separate in [engine-performance.md](engine-performance.md).

## Required gates

Times are UTC on 2026-11-16. Load values are the host one/five/fifteen-minute
averages, before and after each command. This shared host also ran other jobs
and the isolated public read-only hour. These are validation durations, not
a controlled hardware comparison. Builds and native tests each used four jobs.

| Command | UTC start | Seconds | Load before | Load after |
| --- | --- | --- | --- | --- |
| `pnpm check:repo` | 06:33:39 | 0.731 | 7.80/8.76/8.80 | 8.46/8.88/8.84 |
| `pnpm test:quiet` | 06:33:40 | 95.418 | 8.46/8.88/8.84 | 13.90/11.46/9.82 |
| `pnpm rust-wasm:quiet` | 06:35:15 | 81.430 | 13.90/11.46/9.82 | 9.39/10.59/9.65 |
| `pnpm verify:quiet` | 06:36:37 | 68.797 | 9.39/10.59/9.65 | 11.16/10.77/9.77 |
| `pnpm --dir web check` | 06:38:38 | 5.457 | 10.87/10.76/9.82 | 11.20/10.83/9.85 |
| `pnpm --dir web build` | 06:38:43 | 0.309 | 11.20/10.83/9.85 | 11.20/10.83/9.85 |
| `pnpm --dir web smoke` | 06:43:10 | 380.459 | 11.64/11.41/10.37 | 10.67/9.79/9.94 |

Every required command exited successfully. The web smoke includes the mock
application, 128 upload assertions against real Worker bytes, and the real
packaged offline shell with its focused lifecycle fixtures.

## Real Worker conformance

The separate `sh scripts/engine-check.sh` run started at 06:38:39 UTC
and passed 287 checks in 231.786 seconds with no page errors.
Host load changed from 11.20/10.83/9.85 to 11.09/11.26/10.28.
It also ran the profile latency fixture. All relay traffic in this gate used
owned loopback fixtures; local, extension and bunker signing were exercised.

Coverage includes private envelopes and reconstruction after unlock, encrypted
key persistence, publication routing, complete 5000-note paging, two-tab
sharing, dedicated-Worker leader replacement and exact relay authentication.

The route removal/re-admission regressions reject both an old signer success
and an old refusal without settling the replacement job. Their two native
tests failed before the network-wide job sequence fix, then passed with all
17 AUTH integration tests. Real Worker cases cover both races as well.
A fresh-Worker test also proves distinct extension request identifiers, ignores
the old signature and completes the current request. Generic signer requests
now include 128 random bits in addition to a checked counter.

## Test corrections and evidence

The installed browser test helper treats a Promise-returning wait predicate
as truthy. Offline lifecycle and IndexedDB persistence checks now use bounded,
explicitly awaited polling. The old persistence helper failed the focused
three-poll proof; the corrected helper passes it and the real rediscovery case.
No Chromium activation defect is inferred from the former invalid wait.

Offline regressions, storage bounds and browser scope are in
[offline-shell.md](offline-shell.md). The original generator loses the active
cache on a corrupt rollback and grows four waiting caches; the corrected
generator passes both reproductions and the additional lifecycle cases.

Raw gate records remain in `tmp/stream-gates-20261116.json`,
`tmp/final-conformance-20261116.json` and `tmp/engine-harness/report.json`.
The native AUTH before/after logs are `tmp/auth-readmit-before.log` and
`tmp/auth-readmit-after.log`. Public probes retain independent artifact hashes.

## Remaining scope

The new conversation and encrypted-key controls still need Claude's written
interface specification. No layout, CSS or user-facing wording was added.
Public relay testing never signs or publishes; it does not exercise AUTH, DMs,
invoice payments or an owner account. Firefox, Safari and a real OS sleep/crash
remain unmeasured. The corrected public hour is still recorded independently;
its frozen paging-fixed artifact predates the later authentication fixes.
