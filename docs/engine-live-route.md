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

## Verification boundary

Raw EOSE does not make a route's pending EVENT an empty verified answer.
The planner defers promotion while its verification queue is nonempty and
retains the recovered request until that decision is available. Once the
queue drains, productive ordinary routes remain; a truly empty route can
yield. Permission removal and final-view closure still release pending work.
This reuses existing bounded recovery ownership and adds no stored state.

The separate `engine_live_route_verification_test` compiled against the first
fix and failed two assertions: pending A data was treated as empty, and B's
first pending recovery data lost its request before verification. The explicit
revocation control passed. Before ran 17:59:42.067-17:59:51.187 UTC, 9.120 s,
load 2.93/2.69/3.12 to 2.86/2.69/3.11. The unchanged three-case source passed
after the guard at 17:59:54.892-17:59:56.498, 1.606 s, load 2.63/2.64/3.10.
Artifacts are `verification-before` and `verification-after` in the same proof
directory; original four-case evidence remains untouched.

All 23 new and adjacent recovery/stability/history cases then passed in
1.105 s; strict targeted Clippy passed in 3.756 s. The combined interval was
18:00:19.017-18:00:23.878 UTC, load 2.63/2.63/3.08 to 2.58/2.62/3.07.
Commands and full results are in `supplemental.json` and its two logs.

## Remaining checks

A production Worker replay and the full integration gates remain pending.

The fixed number of primary routes remains a coverage tradeoff. This change
cannot establish all-relay completeness, future productivity, or causal
resolution of the seven public-hour candidates.
