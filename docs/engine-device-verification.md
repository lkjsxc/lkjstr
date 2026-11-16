# Device and measurement integration verification

## Purpose

Bind protocol-12 storage observations and historical measurement controls to
the actual source, required gates, production bytes and finite browser proofs.
This is source verification, not deployment or a completed public hour.

The runtime checkpoint is cada84e173352befa4e102548a909a1175a5ffb0. Storage inspection
adds no control, visible word, CSS or layout. The measurement changes select
independent historical witnesses before opening the application and require
signature evidence from the actual control body, separately from cached data.

## Required and additional gates

All dates below are 2026-11-16 UTC. Every listed command exited zero. Cargo
build jobs and Rust test threads were capped at four. Times include each gate's
compilation and execution on the shared host; they are not speedup claims.

| Gate | UTC start | Seconds | Load 1/5/15 before to after |
| --- | --- | ---: | --- |
| root check:repo | 21:07:03 | 0.938 | 1.84/2.13/2.10 to 1.84/2.13/2.10 |
| root test:quiet | 21:07:04 | 135.798 | 1.84/2.13/2.10 to 4.68/3.69/2.72 |
| root rust-wasm:quiet | 21:09:20 | 123.855 | 4.68/3.69/2.72 to 6.09/5.21/3.45 |
| root verify:quiet | 21:11:24 | 125.241 | 6.09/5.21/3.45 to 6.34/6.75/4.32 |
| web check | 21:13:29 | 8.914 | 6.34/6.75/4.32 to 6.30/6.73/4.34 |
| web build | 21:13:38 | 0.527 | 6.30/6.73/4.34 to 6.30/6.73/4.34 |
| sh scripts/engine-check.sh | 21:13:39 | 307.684 | 6.30/6.73/4.34 to 2.13/4.42/4.09 |
| web smoke | 21:18:47 | 396.340 | 2.13/4.42/4.09 to 1.18/2.26/3.20 |
| web build:real | 21:25:23 | 25.034 | 1.18/2.26/3.20 to 2.09/2.38/3.21 |
| web smoke:real | 21:25:48 | 525.546 | 2.09/2.38/3.21 to 2.06/2.01/2.62 |
| web package | 21:34:34 | 0.795 | 2.06/2.01/2.62 to 2.14/2.03/2.63 |

All 1254 tracked files had identical before/after content hashes for every
stage. Each Cargo-using stage refreshed the 646 owned Rust/manifests before
execution. One unchanged worktree owned the shared target; this is a pre-stage
refresh, not interception of nested Cargo invocations. The source-manifest
SHA-256 is:

```text
df7b07b83b4f27f7329cd0affb17a5550503d2573ddf9508a06a15109d3ac13f
```

Evidence lives in the stream worktree's
`tmp/device-integration-tree/tmp/`: `device-gates.json`,
`device-gate-sources/`, `device-reports/` and `device-artifacts/`.
The final summary and copied archive are `device-final-cada/`.
Every required and finite-proof ledger ended with no remaining owned process.
The owned short browser alias was removed. No saved owner account or public
relay was used by these gates.

## Observed coverage

The main Worker report passed all 459 assertions with zero page/Worker errors.
The same conformance run passed these separate finite fixtures:

| Fixture | Passed checks |
| --- | ---: |
| Storage inspection on the conformance package | 19 |
| Inclusive history route | 5 |
| Productive live recovery | 8 |
| Remote signer authorization | 30 |
| Queued authority and original deadlines | 22 |
| Private lists | 31 |
| Referenced emoji sets | 11 |
| Permanent stop | 72 |
| Private signing deadlines | 22 |

The observer preflight includes the 18 historical policy cases. Web smoke
records 418 checks and zero failures. Default real interface smoke passed all
541 assertions with zero errors. The seven additional screenshot-mode checks
remain specific to the prescribed ship command; this default run does not
claim them. Their scope is recorded in
[engine-variants-verification.md](engine-variants-verification.md).

The earlier focused storage proof covers 14 native policy/wire cases, nine
client/mock cases, two transport cases and strict native/Worker Clippy.
[storage-inspection.md](storage-inspection.md) retains their exact source,
timings and initial measurement-boundary corrections.

## Exact production and helper proofs

After the full gates, both historical helpers were rebuilt from the same
checkpoint at 21:35:15 UTC in 1.451 seconds, load 2.06/2.02/2.60 to
2.14/2.04/2.61. The subsequent 0.243-second freeze copied the executables to
`tmp/device-native/d4281ecc40c7f7b4aef4`. No other Cargo build interleaved.

The production storage proof then passed 19/19 at 21:35:53.359 UTC in
0.744 seconds; its containing driver stage took 1.067 seconds. Load was
1.67/1.94/2.55 before and after. It used the immutable production package,
not the conformance package. Its inspection phase counted records without
traversing keys, KV or stored bodies; count/estimate outcomes stayed distinct. Its virtual clock/callback controls
do not measure wall-clock timeout precision or actual physical disk usage.

The native-helper/Chromium historical proof passed 11/11 at 21:35:54.446 UTC
in 0.596 seconds; its driver took 0.848 seconds at the same load. It proves
independent control-body rejection, positive source DOM witnesses and exclusions,
with zero external requests, forbidden frames or page errors. Browser, server,
sockets, profile and temporary-data cleanup completed. This is a finite
instrumentation proof, not a production application or public-network result.

The original retained reports are `tmp/storage-final-yrph61p5/report.json`
and `tmp/historical-witness-proof-48pete/report.json`; their collected copies
are bound to the latest passed stages in `device-gates.json`.

## Corrections retained in the record

The first merged conformance attempt was deliberately stopped at 20:29 UTC
to correct public-only wording: the event store also holds encrypted DM/list
payloads. No runtime calculation changed, and exit 130 is not a product failure.

The next conformance attempt exposed a missing owned temporary parent in the
media fixture. The fixture now creates its parent before allocating fresh TLS
data. Both loopback listeners and cleanup were verified with that parent absent.
The following conformance run passed; its native gate then found formatting in
the historical verifier. The formatter-only correction changed no eligibility
rule. The final complete sequence above passed on one clean checkpoint.
Original failures remain in the ledger; no assertion was removed.

## Frozen identities

The production graph is frozen under
`device-artifacts/95c91fbff0685636fc8d`. The production build, asset emitter
and exact retained-tar package guard reject known conformance-only exports.
The production WASM is 8259447 bytes; the compressed archive is 1592115 bytes.

```text
harness WASM c4c5882c8f592e26c33fba00f12c0d770d94a627fa2418426682aa8e5530fb5e
product WASM 9088e280584f9c35372b96b6fbd2a07b4ee6e14b3c276b4f45f5f44b0ebe6aef
raw bindings 9caf969e1e2020e1bb4a319f6829c32a560e1342e0658b168d81cc2835579ddc
index.html   59f311836e2ec3f088e2e15057231dddc8916a26185358e33cd055b7972ad99e
archive      840d371f00f32c709a3ee396ff766536c27a0b1e4fdbfeeb43786e80a85aa33c
main report  033dbf8c0d6830f0b0f56c916170d6cac0326a40209157377e2ebacba1c7c168
real report  62f5b1f0ba83bd5e6a0363f87d227ac878e3d69bf46feda1b89842015fbb6ad3
storage      61b3a57eb79a3f96be9fa32852306074061d6f0a1c677414c2b4d81d4010cc18
history      044d1d463f34be54443d70c563adfaed587cff063d98cd872cd15dd22469e247
verifier     4f5a733852c31b6657916f974f2d6d47ace6a3ac39e6dc5422c1eb5001049600
fixture      1fd9b73195250ad6d9fdea17fb83486f557f94c4ed82095d8c88e3d2c5f4bad2
gate record  df6acdc057f5732f955acd879f396d08030aca87a88acafcb302b2dde2267b26
summary      2c44f9a8aa3deae44d8cfe42e2063419882c24ae16b5aeae93b461ed116b9c80
```

## Remaining boundaries

Storage inspection has no surface. It does not provide physical per-store
bytes, clearing, settings archives or setup sync. The events count includes
encrypted relay payloads; a future selective clear must preserve dependencies.
Account whole-record write races and failed/corrupt boot reads are a separate
audit; this inspection adds no account concurrency fence or loading correction.

The ninth public hour still has to exercise the new historical controls.
The sixth run's seven Home candidates remain unresolved by public evidence.
Neither finite verification nor package validation establishes the live site:
the last confirmed successful ship remains 541e4a1e.
