# Unchanged-product read-plan baseline

## Purpose

This is Q5's baseline before Q1 optimizations, using the account-store release
`07e881784286c3e021db59f739c6ff438ea58fec`. It measures actual Engine effects and
public wire traffic. It records no improvement claim and no total public recall.
Definitions, replay and comparison: [read-score.md](read-score.md).

## Durable evidence

All raw runs, helpers, captured source, package bytes and the old opening-race
artifacts are preserved outside the disposable worktrees at:

```
/home/coder/workspace/lkjstr-review/read-score-20261117-baseline
```

The original manifest records every archived file's bytes and SHA-256, plus
product source hashes and compact metrics.

```sh
git show 8e8733596086e5dbdd75e8cb3be5b1af27113134:docs/read-score-baseline-data.json
```

Reports and raw body sets remain unchanged. Derived scorecards and audits are
separate files. The native fixture's generated data contain no owner account.
The public account is read-only and distinct from the owner's data.

## Build identity

| Artifact | SHA-256 |
| --- | --- |
| Exact production archive | eb633111cf2c00df656bf7bbbc396d695b00df51a61796d9a244214b91c311cb |
| Production index | fa3286676dd34d61f91a2e5d060123b7a0ec3fee18a1cdf5184f3e8c0ac16468 |
| Production engine WASM | 59e2121a2dfc9c5c2f1e10963edf65f0f18c4fed0d5f86e0f4f0a1869c727cc5 |
| Frozen native verification helper | 914ffdc83b789ebf07a079c254a3a3bdf181e5ef3ad7d7a99548195bf11504c0 |
| Final native fixture binary | 4d4e6b2cd041cd6e19eadbaaf49563c4b4c0d19eddb6d781407293fa7ab806b5 |
| Actual product source manifest | c0853eff41336b4d33024b609fe9e09daccf6154bb9e49bfb1d61613e824251d |

The shared Cargo cache can retain another worktree's core library. Baseline core
and Worker source timestamps were invalidated under the shared build lock before
both final helpers were built. Frozen binaries were copied before any run.
Product sources equal the unchanged release; measurement examples are additional.

## Deterministic actual-engine baseline

The 32-relay, 300-author fixture opens Home, Notifications and three profiles.
It returns signed events in response to actual emitted filters, through the
normal network parser, verification queue, store and row outputs. The result is
exact for this fixture, not a modeled selector estimate.

| Metric | Cold store | Warm store restart |
| --- | ---: | ---: |
| Exact recall | 331/331 | 331/331 |
| Distinct wanted new events | 290 | 0 |
| Requests | 53 | 145 |
| Connections / peak | 8 / 6 | 30 / 8 |
| Wire events | 527 | 671 |
| Duplicate wire events | 214 | 358 |
| Held wire events | 33 | 671 |
| Unwanted wire events | 6 | 5 |
| EOSE zero-yield requests | 31 | 100 |
| Requests without EOSE | 0 | 45 |
| Payload bytes, both directions | 515907 | 1116770 |
| First 50 Home rows, simulated ms | 375 | 0 |
| All five views, simulated ms | 600 | 0 |

The warm ratios are unavailable because no new event was wanted. Held and
unwanted are overlapping classifications, not an additive partition. The
separate predicted-zero-yield counts are 43 and 145; they do not replace actual
EOSE evidence. Seven daily generated behavior traces retain real relay quality
checkpoints; this is synthetic behavior, not a claimed human usage record.

The final native run was 2026-11-17 02:45:18--02:46:09 UTC, with starting load
7.16/7.40/6.00. Reported row times use the deterministic relay clock and make no
CPU, browser paint or live network speed claim. An earlier forced rebuild
reproduced all cold request, event, byte and row-completion numbers.

## Frozen public baseline

The 300.001-second observation ran 2026-11-17 02:29:43--02:34:50 UTC.
Starting host load was 3.33/3.77/4.43; final load was 5.58/4.12/4.36.
The exact release was served on loopback with production response headers.
An existing owned TLS-preserving route served the account image. This is not a
measurement of the release's public WAN/TLS delivery leg.

The 31-candidate scope came from observed routes and verified signed hints for
this account. Its hash is
`1708910557f3ef120037e91a113c36a71242d7e2b4760a727dd9eff13dd44e96`.
No socket escaped that scope; no guard denial, publication attempt, rate-limit
notice or refusal was observed. Home, Notifications and all three correct
profiles opened, each with its real 60-row window. Initial event IDs were empty;
the setup-only blank page wrote identity metadata without executing the app.

| Metric | Result |
| --- | ---: |
| Verified witnessed recall | 94/95 (98.947%) |
| Native semantic wanted-new events | 1079 |
| Requests / connections / peak | 756 / 24 / 14 |
| Wire events | 3020 |
| Native-body duplicate wire events | 1561 (51.689%) |
| Raw serialized-body duplicates | 1472 |
| Held / unwanted / unverified wire events | 0 / 1103 / 5 |
| EOSE zero-yield / unanswered requests | 307 / 4 |
| Received / sent payload bytes | 31323847 / 412302 |
| Total payload bytes | 31736149 |
| Strict hydrated Home first screen, ms | 849 |
| First text / settled screen, ms | 565.6 / 849 |
| Strict all-visible completion | unavailable |

The three controls witness a fixed 24-hour span ending at 1794882578 UTC epoch,
with up to 50 eligible rows per view. They do not enumerate all events on all
31 candidates. Wider public recall remains unknown. Semantic useful-new counts
are broader than those witnesses and do not claim every event was visible.
Wire bytes exclude WebSocket framing, TLS and compression overhead.

The raw fingerprint included JSON object key order. The 1548 retained body
variants contain 1459 distinct native event bodies; all 89 excess variants differ
only in serialization. The derived scorecard corrects duplicate events to 1561
and retains the original 1472 counter. Raw reports are unchanged. Future
collection fixes field order before hashing; a regression covers this case.

One wanted witness was received and verified but absent from the physical
product store at the capture cutoff. It matched recorded filters and was not
outside their quotas. Its ID is
`f9d1579026712cc108fa3d21727fa4dc0155481c1b7aad5e20d7da1ef5421165`.
Persistence timing, queue loss and other engine causes are not distinguished by
this capture. It is a loss in the observed score, not a fabricated relay miss.

## Request replay evidence

Of 756 requests, 602 repeated the exact same relay and filters, including time
bounds and limits. Set-order normalization added no extra cases. The median
replay interval was 2751 ms. There were 691 client CLOSEs and 13 socket CLOSEs.

565 replays followed an identical, closed, single-filter, non-full request whose
EOSE arrived before its CLOSE. 37 retained unknown prior coverage. Among cleanly
completed replays, 392 returned only IDs already returned by such completed
prior requests and 143 returned empty; none returned a new ID. Six replays were
closed before EOSE and never counted complete. Empty live replays can still
check a time gap; these counts alone do not prove every replay avoidable.

Notifications account for 244 completed duplicate-only replays, authored reads
for 148. Stable notification predicates were sent 139 times to one relay and
113 times to another. Source inspection identifies live-slot rotation as a
plausible cause; the capture does not reveal private scheduler decisions or
verification-queue pressure. New captures retain delivery and socket ledgers.

Count work sent 26 requests for 2633 target appearances across 282 distinct
IDs. 1982 appearances repeated a target already asked on the same relay; eight
requests added no new target. Several 120-target buckets added one target while
reasking 119. Some time bounds changed, so this is churn evidence, not a count
of requests proven unnecessary. The complete chronological audit is retained.

## Earlier diagnostics and remaining gates

The 30-second calibration and initial normal-route 300-second sample are kept,
but are not five-view Q5 baselines: an incorrect profile-state namespace left
three profile panes empty, their candidate scope was not frozen, and their
helper's baseline source provenance was not established after cache reuse.
Their exact product archive is valid. These limitations are attached separately
without modifying the original reports.

The scorecard's Node regressions, native clippy check and actual signed fixture
passed. Full hour, full nostter matrix, phone matrix and two-hour repeat-cache
measurements have not been run by this change. Earlier opening-race evidence
is preserved, with its own failures and scope. No browser runs overlapped.
