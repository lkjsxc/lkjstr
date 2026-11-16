# Private integration verification

## Purpose

Record the sixth integration's checks, corrections and artifact boundaries.
The worktree is `tmp/private-integration-tree` under the canonical checkout.
This evidence describes a gated candidate; deployment and public-hour results
are recorded separately.

## Scope

Protocol 10 adds bounded private-list reads for local, extension and bunker
accounts. Query visibility and account ownership control external reads.
Cancellation remains independent of Messages consent and refusal. The batch
retains protocol 9 zap evidence, unpaid invoice intents, reading hints,
private editor coordination and upload cancellation.

Time-rail overflow measurement is also batched. DOM structure, row heights,
string tables and CSS stay unchanged; native-scrollbar views retain their
existing sequential behavior. See [private-lists.md](private-lists.md) and
[frontend-layout.md](frontend-layout.md) for policy and measurements.

## Corrections and before evidence

The frontend rechecks private-list authority after every awaited extension
operation. Cancellation, hiding, account revocation or expiry cannot begin
another decrypt or identity call. Live requests retain signer identity checks.
Nine await-boundary cases failed before at 13:53:57 UTC on 2026-11-16; all 22
adjacent cases passed afterward, and the feature web check took 5.966 seconds.
An existing extension dialog cannot be dismissed programmatically.

Combining private-list and zap completion exposed three failures: invented
relay phase, replayed zap evidence and a replaced query's prior phase.
All three reproduced at 14:08:39 UTC in 9.889 seconds; the reverse-order case
passed as a control. Four corrected cases plus ten adjacent cases and the
Worker WASM check passed at 14:09:32 UTC in 10.463 seconds. Load changed from
2.74/2.89/2.80 to 2.62/2.86/2.79 in the passing run.
Both caches now retain bare observed relay metadata and emit current evidence.
Logs: `tmp/private-state-{before,after}.{log,json}`.

Merged Worker conformance then exposed a logical-view reopening defect.
Session cleared query state while Network suppressed an unchanged Status.
Three native failures reproduced at 15:12:45 UTC in 0.779 seconds, load
0.97/1.55/1.94: same-query replacement, different-query replacement with equal
relay counts, and an undelivered old Status seeding its replacement.
Two close/reopen controls passed. Each accepted Open now resets only the
observer and queued Status, preserving shared requests and history cursors.
All five new and sixteen adjacent cases passed at 15:13:41 UTC in 4.764
seconds, load 1.38/1.60/1.94. The runtime correction is `09577933`.
Logs: `tmp/sixth-reopen-{before,after}.{log,json}`.

The initial private fixture also read loading before an independent relay
State arrived. It now waits for that actual State while withholding the signer
reply. Its account-removal case uses a fresh signed named-list address and
asserts the exact crypto sub/event before removal and a valid late reply.
The prior fixture broadcast a mute replacement after its finite lookup closed;
that delivery timeout was separate from the reproduced runtime defect.
The corrected fixture passed 31/31 on immutable harness bytes in 10.617 seconds
at 15:18:01 UTC, load 1.05/1.36/1.76. Report:
`tmp/sixth-private-fixture-try3/report.json`.

The contract generator rejected the new indexed `Failure['code']` type before
the main harness could start. It now resolves short literal required properties
of known object shapes, preserving the exact existing union. Three validation
cases failed before and pass afterward; unknown/non-string errors remain
rejected. Early harness failure prints the bounded original log even without
a completed report. This was a harness-only correction in `3dea0560`.

The first strict native rerun stopped on a missing test-only `expect` allowance.
Commit `0fce34b6` adds that annotation without changing runtime or assertions.
Every failed gate attempt and its report remain in `tmp/sixth-gates.json` and
`tmp/sixth-reports/`; failed browser cleanup was checked before another run.

## Required checks

All commands below passed. Times are UTC on 2026-11-16; compilation and native
tests used four jobs/threads with exclusive ownership of the shared target.
Browser profiles, loopback origins and packages belong to this worktree.

| Gate | Start | Seconds | Load before | Load after |
| --- | --- | ---: | --- | --- |
| `xtask tests` | 14:56:57 | 2.418 | 1.48/1.40/1.70 | 1.48/1.40/1.70 |
| `check:repo` | 15:29:30 | 0.615 | 1.65/1.42/1.54 | 1.65/1.42/1.54 |
| `test:quiet` | 15:30:33 | 97.308 | 2.04/1.53/1.57 | 5.63/3.26/2.21 |
| `rust-wasm:quiet` | 15:32:10 | 84.763 | 5.63/3.26/2.21 | 4.78/3.59/2.42 |
| `verify:quiet` | 15:33:35 | 76.952 | 4.78/3.59/2.42 | 3.44/3.47/2.48 |
| `web check` | 14:59:33 | 6.325 | 4.00/3.60/2.57 | 3.84/3.57/2.57 |
| `web build` | 14:59:40 | 0.314 | 3.84/3.57/2.57 | 3.84/3.57/2.57 |
| `web smoke` | 15:34:52 | 370.285 | 3.44/3.47/2.48 | 2.55/2.51/2.32 |
| `engine conformance` | 15:25:12 | 257.096 | 0.46/0.98/1.47 | 1.65/1.42/1.54 |

The initial repo/native/rust-wasm pass predated the reopening correction.
The table uses their corrected reruns. Web check and the mock build remain
valid for unchanged frontend source; the final default smoke rebuilt and
exercised the corrected production engine. A final repository documentation
check is performed before landing.

## Real Worker evidence

Combined conformance passed 452 main checks with zero page errors, 31 private
list checks, 72 stop/lifetime checks and 22 signer deadline checks. The same
gate passed 42 transport cases, 20 host-observer cases and three contract
validator regressions. Profile-latency fixture: 307.3 ms from note to profile
with a configured 240 ms relay delay. These are loopback measurements.

The main browser run was 15:25:29.422--15:29:28.686 UTC; the complete gate
including all helpers took 257.096 seconds. The observed main action set
includes an actual successful account-scoped `lists.retry` request and reply.
All Worker replies are checked against the worktree TypeScript contract.
Reports: `tmp/engine-harness/report.json`, its `profile-latency.json`,
`tmp/engine-private-lists/report.json`, `tmp/engine-stop/report.json` and
`tmp/engine-dm-sign-deadlines/report.json`.

The default web smoke passed mock UI, paired note-layout fixtures, 131 real
upload checks and offline shell integrity/lifecycle tests. It does not stand
in for the prescribed deployment's separate complete real-UI smoke.

## Artifact boundaries

Final source checkpoint: `0fce34b667dea23f2ee03a60363860c725259228`. Its only difference from the successful
main-conformance checkpoint is the fixture expectation allowance.
Harness WASM SHA-256:
`bcdecf90390250049318ca2daebcfd5b0252c72f56fbe0e8660a3a0745e165b1`.
Final production WASM SHA-256:
`1c0b50bef2a56c5def00dba885358481fdad1037d9b9f2127ff233d5131a6f97`.
Final production index SHA-256:
`371df519b8882ab8425ab41997e40f8b83328ac26a540e43b4bc5b60195b42b3`.

The earlier isolated private suite used `9527440b` WASM; it was not a merged
protocol-10 run. The failed first merged harness used `57da73b5`, retained in
its report/manifest. Old production `8542169d` and its complete dist were
preserved under `tmp/sixth-before-reopen`; corrected harness bytes were copied
to `tmp/sixth-engine-try2-preserved` before further package builds.

Upstream startup/resource-graph corrections were retained during rebase onto
fifth-landing `97c0d7f9`. The conformance merge preserved all host-observer and
transport suites plus the private fixture step. No public relay publication
or payment is part of these tests. The mandated public hour after the sixth
landing must use the actual merged release bytes; earlier hours and the
synthetic layout fixture do not substitute for that follow-up.
