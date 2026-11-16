# Variant integration verification

## Purpose

Bind the protocol-11 integration to its actual native, Worker, interface and
production-package evidence. This records source verification, not deployment.

The runtime checkpoint is 9766cd1ad5d12ae9f5f10a995807bef0d6e7d2de. It combines
owner-bound remote-signer authorization, referenced emoji sets, retained Search
people/languages, native-scrollbar fitting, immutable measurement observations,
productive live recovery, unavailable-repost windows and exact archive guards.
No new visible words, CSS or surface are introduced by this integration.

## Required and additional gates

All dates below are 2026-11-16 UTC. Every listed command exited zero. Root and
web commands use pnpm; the shell conformance command is shown explicitly.
Cargo build jobs and Rust test threads were capped at four. These are elapsed
gate lifetimes on a shared host, including compilation where applicable.

| Gate | UTC start | Seconds | Load 1/5/15 before to after |
| --- | --- | ---: | --- |
| root check:repo | 19:44:26 | 0.948 | 0.59/0.90/0.98 to 0.59/0.90/0.98 |
| sh scripts/engine-check.sh | 19:44:27 | 305.797 | 0.59/0.90/0.98 to 2.06/1.80/1.36 |
| root test:quiet | 19:49:33 | 117.053 | 2.06/1.80/1.36 to 4.52/3.61/2.13 |
| root rust-wasm:quiet | 19:51:30 | 123.621 | 4.52/3.61/2.13 to 4.09/4.35/2.65 |
| root verify:quiet | 19:53:34 | 124.263 | 4.09/4.35/2.65 to 4.06/5.21/3.24 |
| web check | 19:55:38 | 8.606 | 4.06/5.21/3.24 to 3.83/5.12/3.24 |
| web build | 19:55:47 | 0.525 | 3.83/5.12/3.24 to 3.83/5.12/3.24 |
| web smoke | 19:55:48 | 395.534 | 3.83/5.12/3.24 to 2.03/2.63/2.72 |
| web build:real | 20:02:23 | 24.709 | 2.03/2.63/2.72 to 1.82/2.53/2.68 |
| web smoke:real | 20:02:48 | 526.064 | 1.82/2.53/2.68 to 1.79/1.90/2.27 |
| web package | 20:11:34 | 0.745 | 1.79/1.90/2.27 to 1.79/1.90/2.27 |

All 1224 tracked files had identical before/after content hashes for every
stage. Each Cargo-using stage refreshed the 638 owned Rust/manifests before
execution. One unchanged worktree held the shared Cargo target throughout;
this is a pre-stage refresh, not interception of nested Cargo invocations.
The complete source-manifest SHA-256 is:

```text
3cc693bf163928b0afea54d999393cb5eb59abef1f8bf818abc8cceb319e138d
```

Evidence lives under the stream worktree's
`tmp/variants-integration-tree/tmp/`: `release-gates.json`,
`release-gate-sources/`, `release-reports/` and `release-artifacts/`.
The final summary and copied archive are `release-final-9766/`.
All eleven process ledgers ended with no remaining owned processes; the
temporary browser directory was emptied and its owned short-path link removed.
No public relay or saved owner account was used.

## Observed coverage

The main real Worker report passed all 459 recorded assertions with zero
page/Worker errors. Its Search fixture now warms a verified unavailable repost
before retaining the same seven people, quota, anchor, Fresh and language checks.
Finite fixtures passed separately in the same conformance gate:

| Fixture | Passed checks |
| --- | ---: |
| Inclusive history route | 5 |
| Productive live recovery | 8 |
| Remote signer authorization | 30 |
| Queued authority and original deadlines | 22 |
| Private lists | 31 |
| Referenced emoji sets | 11 |
| Permanent stop | 72 |
| Private signing deadlines | 22 |

The web smoke report records 418 checks with no failures. Its native/time-rail
layout fixture completed all four cases and two boundary checks without errors.
Default real interface smoke records 541 assertions, all `ok`, with zero
errors. The previous prescribed ship recorded 548 because it enabled
`LKJSTR_SHOTS=1`: seven additional assertions cover narrow time rails,
Reset Layout and language reloads, and server marks in a second page.
Those four smoke source files are unchanged from ce05e292. The current default
run does not revalidate these seven screenshot-mode states; the prescribed
ship command includes them. The count difference is not a product failure.

The original first conformance attempt stopped in the emoji HTTP fixture,
which selected response headers before reading a missing file. The test-only
correction preserves all assertions. The second attempt exposed the existing
unavailable-repost quota defect in a previously warmed cache. Native and frozen
Worker before/after proof identifies that cause; the third full run passes.
The corrected independent proof also retains its earlier observation-only
failure instead of relabeling it as a pass.

Detailed decisions, original failures, controlled corrections and limits are in
[bunker-auth.md](bunker-auth.md), [emoji-sets.md](emoji-sets.md),
[search.md](search.md), [unavailable-reposts.md](unavailable-reposts.md),
[frontend-layout.md](frontend-layout.md), [engine-live-route.md](engine-live-route.md)
and [engine-package.md](engine-package.md). Timed pre-fix failures that include
a deliberate timeout are correctness evidence, not speedup measurements.

## Frozen artifact identities

Harness bytes and production bytes have different identities. The conformance
package is frozen under `release-artifacts/7ac2ce0793908b5a1f9f`; production
assets are under `release-artifacts/65e8515f3460431b0219`. The actual production
build, asset emitter and retained-raw-tar package audit all reject known harness
exports/bindings. The archive contains the one production WASM and reachable
loader audited before compression. Packaging does not rebuild; its archive
guard reads retained tar bytes without reopening dist or instantiating WASM.

```text
harness WASM 04e309d63831cfcc974674a282b4e6bcce6349f16703f5f1b9bbf39411f54774
product WASM 957317e78f583564327d6983bc10f9a205d851a65a70322c136765aaffa350b2
raw bindings ed782560c12643d0faf8ba6426bed08a41345b15bc5c4fd9b3d5d83f17ee4b2f
index.html   5813e71f6f0252a7dd993de01256681c6398c1f3b6e6dfb7c2080935aac39c28
archive      583876d7fea31c52b1b41571c73684bc858bd4978afb96a3edb87a12fe80beab
main report  8e149c31b5f37b97bcbe5d9ced0e346118611f7bda84e85f2acaf725a07ba5d6
real report  bde32d86bf3cc18b1cc9cced5456bfa708e3b92badb359427021f8b21e3fd2e9
gate record  ef078adbc8bddf60bb400eaf2f39c5e6f6f29cc584480f2be3c0ab0c4c5a015f
summary      866794bb6a71f519689681aa4e6e032c2536fb90e8be2d29f882a3a4bbc9dc47
```

Production WASM is 8,135,128 bytes; the compressed archive is 1,575,147 bytes.
The summary retains every finite report hash and start/end load. Archive
validation establishes package content, not what a remote host currently serves.

## Remaining boundaries

The sixth public hour's seven Home candidates are still unresolved.
The live-route fix does not prove their availability or causal resolution.
Notification/thread controls in that frozen run were uninformative; a new
required hour follows the ninth landing. Host/OS sleep and indefinite resource
bounds remain unproven. Refer to [engine-performance-sixth.md](engine-performance-sixth.md).

Signer authorization still needs Claude's surface; fallback followers and
background relay AUTH cannot present its private URLs. Remote people discovery,
encrypted emoji sets and real intermediate upload bytes remain unsupported.

The seventh prescribed ship failed at the host operation after its real UI
and package checks. There is no successful receipt or served-index verification
for that attempt. The last confirmed successful ship remains 541e4a1e.
Read-only host diagnosis was requested through Desk because the handoff
forbids extra host commands. This integration has not been deployed.
