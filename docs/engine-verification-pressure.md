# Verification pressure and historical completeness

## Purpose

Keep raw relay completion separate from acquired, verified history, and preserve
an interrupted page when the bounded verification queue rejects an event.
These are engine decisions; no new visible control or wording is introduced.

## Observed boundary

A combined loopback conformance run stopped at 4608 of 5000 continuity notes.
Its page 24 expected 4638 rows after 4448; raw requests had descended to the
fixture's oldest range. That report did not capture verification-drop counters,
so its exact loss cause is not established. The preserved artifact is
`tmp/real-hour-continuity-failure.json` in the stream worktree.

A separate runner against the same frozen package returned all 5000 rows and
5000 physical IndexedDB events, with zero drops/rejections. Verification queue
peak was 3240 and maximum tick 551 ms. It ran 129.939 seconds, sampled load
8.65 at start and 6.88 at finish. Detailed fixture, requests and report are in
`tmp/continuity-debug-bmfOIq/` under the next integration tree. This demonstrates
substantial run-ahead, but does not retroactively prove the earlier loss cause.

Native tests establish the independent defect: raw EOSE allowed both automatic
refill and an explicit Window to advance while the current page was still in
the verification queue. A separately forced queue rejection could nevertheless
make that page appear exhausted. The queue holds at most 4096 events or 8 MiB;
verification consumes at most 32 per engine tick. Additional pages must wait.

## State and release rules

`advance_history` and `refill_history` now wait while verification remains.
Source exhaustion also stays unknown until the backlog drains. This prevents
fast EOSE responses from driving historical acquisition ahead of verification.
Other live traffic can delay history while it drains; the queue bound is fixed.

An accepted active-relay event rejected by that bound calls
`Network::verification_dropped`. Every member of its physical envelope loses
page-completion evidence: `page_eose`, `eose` and `complete` become false;
`received` and `oldest` clear. The existing `filter` and `page_filter` remain.
The wire closes, so a late EOSE cannot acknowledge the interrupted page.

`Request.verification_retry` is one boolean on each existing bounded request.
It delays retransmission until the backlog drains, with a 1-second retry delay
that doubles up to 60 seconds on repeated pressure. It propagates when an
unfinished route is cloned for an advancing logical cursor. Both ordinary
scheduling and finite multi-filter batching respect this delay.

A new send clears that scheduling flag; existing incomplete-page fields then
track the in-flight retry. Its raw EOSE still cannot advance the view before
verification finishes. Hiding the last view, removing its route or revoking its
applicable read permission releases the request and its retry state. There is
no independent retry registry or timer that outlives the request.

This replay applies to an accepted event associated with an active relay
request. It is not proof that every relay retains every event or that every
backdated live note will be replayed by a finite relay response. The public
hour's two coverage candidates and limited relay scope remain in
[the hour audit](engine-performance-hour.md).

## Regression evidence

`engine_verification_history_test.rs` covers automatic refill, explicit Window,
unverified short-tail exhaustion, and a rejected event followed by a fresh
successful replay of the original span. Auxiliary profile/count lookups receive
EOSE in the fixture; diagnostics select the latest actual snapshot.

`engine_verification_replay_test.rs` covers timestamp ties, a stale old-wire
EOSE, partial acceptance before pressure, replay duplicates and the next inclusive
historical boundary. Recovery yields all 201 expected unique rows. It also
checks that closing the final view or removing the route releases retry work.

The final controlled before run disables only the new verification guards and
drop handler, restores source in a `finally` block, and fails. The exact restored
source passes all five focused tests. Logs are
`tmp/real-hour-verification-history-before.log` and
`tmp/real-hour-verification-history-after.log` in the stream worktree. Required
combined gates remain recorded separately by the landing verification ledger.
