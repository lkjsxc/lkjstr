# Zap projection measurements

## Purpose

Record the bounded receipt workload and controlled scheduling regressions for
the protocol-9 candidate. These are native fixture measurements on the shared
host; they are separate from the public-network hour and browser rendering.

## Target index workload, 2026-11-16

Command: `cargo test -p lkjstr-core --test engine_zap_projection_workload_test
-- --ignored --nocapture`. The fixture uses 800 signed notes and 15200 signed
receipt candidates, matching the default 16000 regular-event store bound.
Each note has 19 unresolved candidates. Three rounds project all 800 totals;
each result must remain zero authorized millisatoshis and 19 unverified claims.
Fixture signing/setup happens outside the projection timer.

| Measurement | Before target index | After target index |
| --- | --- | --- |
| 800 target totals, average of three rounds | 462.144 ms | 23.566 ms |
| Three-round projection total | 1386.433 ms | 70.697 ms |
| Whole fixture command, including signing/setup | 61.423 s | 63.384 s |
| Measurement block start, UTC | 12:46:25.994 | 12:54:17.115 |
| Block load start, 1/5/15 min | 1.39 / 1.43 / 1.71 | 3.59 / 3.03 / 2.41 |
| Block load end, 1/5/15 min | 3.50 / 2.24 / 1.99 | 6.18 / 3.97 / 2.79 |

The start/end load samples describe the containing proof block, including
adjacent native tests. They are not per-iteration samples. Both builds use the
unoptimized native test profile, four Cargo jobs and four test threads.
The projection timer improved by about 19.61 times in these single runs.
There is no claim about release WASM, paid/authorized invoice validation,
browser frames, public-provider latency or a distribution across devices.

The index maps each retained receipt ID and queued validation sequence to its
target. Totals/pages examine only that target's candidates, while canonical
selection still uses the global provider/recipient/payment-hash group.
Eviction removes all corresponding index/queue memberships. Hidden candidates
stay retained without consuming current-target validation slots.

Raw records: `tmp/zap-native-proofs.json`, `tmp/zap-index-after.json`,
`tmp/zap-proof-projection.log` and `tmp/zap-index-projection.log`.
The frozen preceding sources are in `tmp/zap-projection-before-source/`.

## Controlled correctness proofs

Two validation-scheduling cases failed on the preceding global FIFO: a new
explicit receipt query and a newly visible target both waited behind 64
unrelated cached candidates. The corrected before run started 12:48:08.402 UTC,
load 2.66 / 2.13 / 1.95, and took 2.368 seconds. Both pass with the target index.
An earlier attempt failed to compile because of an ambiguous test import;
that attempt is not counted as the before proof.

At 12:54 UTC, 65 native cases passed: 60 zap policy/scheduling, three durable
Seen cases and two runtime cases. The command block took 11.687 seconds.
The canonical-receipt regression failed before retaining bounded logical
payment acknowledgements: eviction of the seen receipt exposed its duplicate
as unread. The corrected persisted-account round trip remains read.

Three runtime admission cases then failed at 13:01:12.339 UTC, load
1.45 / 2.95 / 2.79, in 7.804 seconds: a large first tile, an old retained
anchor and duplicate views could each starve another current target.
Five runtime cases now pass, including an independent reading hint within
retained history and rejection of another subscription's undelivered key.
Two additional selector cases prove rotating settled capacity and retaining
unfinished work until it settles or is hidden.

The selector/native/strict-clippy block started 13:14:04.065 UTC, load
2.14 / 1.65 / 1.99, and took 12.683 seconds. Core/NIPs all-target and Worker
wasm32 clippy both passed. Runtime proof logs are
`tmp/zap-visible-before.log`, `tmp/zap-visible-after-runtime-fixed.log`,
`tmp/zap-visible-after-selector.log` and `tmp/zap-visible-complete.json`.

Three transport reading-replay cases failed before and pass after. All 39
transport cases pass after the addition; full frontend `pnpm check` passed.
The finite real Worker HTTPS/signing run then passed 40/40 checks in 64.148
seconds at 13:23:53.643-13:24:57.791 UTC, load 2.61/2.13/2.03 to 1.16/1.80/1.92.
An observed signer timeout lasted 60018 ms; its clock was not advanced. The
remaining default/full integration gates are separate. No owner account,
public publication or payment was used in these measurements.
