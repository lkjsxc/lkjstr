# Productive live-route recovery

## Purpose

Preserve a recovered reader's proven live data when the ordinary slots are
occupied by answered routes that have supplied no verified matching note.
This policy is native Core behavior; it adds no protocol, interface or word.

## Observed failure and bounded decision

The completed sixth public hour recorded a productive ditto socket closing,
then a recovered Home request answering one event and EOSE before the client
retired it. The next 201 Home requests on the two remaining routes returned
no events. Five independently eligible controls were absent after this
retirement. That trace motivates a deterministic test; it does not establish
when those public notes became available or prove a delivered-EVENT loss.

The native fixture uses three loopback-named routes and locally signed events.
B supplies verified matching data, disconnects, and C takes its primary slot.
A and C answer empty; B later replays verified data and EOSE. Previously the
planner immediately closed B, so a subsequent unique signed B note was rejected
as belonging to a retired request. A second case keeps a productive C fallback
and proves the same B loss while A is still empty.

For an unchanged live logical filter, the recovered route may replace an
answered empty ordinary route. Existing `last_event` is evidence only after a
verified matching event with an admissible timestamp; raw frames receive no
credit. Productive or unresolved ordinary routes cannot yield. This keeps two
primary routes, does not occupy a slot with an explicit relay hint, and still
releases requests after read-permission removal or the last view closing.
No unbounded collection, retry timer, or retained payload is added.

## Native before and after

The exact four-case test is `engine_live_route_recovery_test`. On the unchanged
`ce05e292` planner, compilation succeeded and two assertions failed: the new
B-only note was rejected after CLOSE/Disconnect, and B was retired despite an
empty A slot alongside productive C. Unverified-no-credit and explicit
permission/view-release controls passed.

Before ran 2026-11-16 17:55:38.450-17:55:47.462 UTC, 9.012 s, load
1.73/2.43/3.21 to 1.75/2.42/3.20. After ran 17:56:06.722-17:56:08.715,
1.993 s, load 1.54/2.33/3.16 to 1.82/2.37/3.17; all four passed. Test source
hashes are identical. Repository Rust source mtimes were refreshed before each
compile to avoid stale shared-target reuse. Both jobs and test threads were
capped at four.

Artifacts are in the isolated live-route worktree at
`tmp/live-route-proof/{before,after}.{json,log}`. They include exact commands,
source hashes, timestamps and load. The test uses signed synthetic data only;
no public relay, owner key or browser was involved.

## Remaining checks

This checkpoint has not passed adjacent routing tests, strict Clippy, a
production Worker replay or the full integration gates. A queued-verification
boundary also needs a separate regression: an EOSE-complete route with no
verified watermark can still have an EVENT awaiting verification. Promotion
must not retire that unresolved data, and recovered ownership must survive
until the verification decision is available. The four-case proof above does
not claim that boundary is covered.

The fixed number of primary routes remains a coverage tradeoff. This change
cannot establish all-relay completeness, future productivity, or causal
resolution of the seven public-hour candidates.
