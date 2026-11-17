# Read traffic follow-up

## Purpose

Hydration coalescing, finite-envelope lifetime and verified-duplicate resumption
reduce repeated REQs without changing views, strings, Stats columns or feed order.
The product retains complete logical feed filters on two selected configured relays.
Device-wide dynamic author two-cover and cross-relay negentropy are unfinished.

## Hydration

Pending kind-0 authors, event IDs, finite kind-3 authors and count targets merge
per relay and family during a 75 ms window. Arrivals retain the original deadline;
they cannot postpone a bucket forever. Author and ID batches cap at the smaller
of 120 and the relay's max_limit. Count filters retain their 200-event limit and
120-target cap. Families with different channel kinds remain separate.

Transmitted finite buckets remain immutable while any of their targets is wanted.
In-flight IDs/authors are subtracted before building new buckets. Cached profiles
and cached profile kind-3 lists need no visible-row hydration. Missing profiles
start on one note-delivering route (or the first configured reader); completion
without a profile permits fallback. Explicit owner refresh and live TheirHome
follow watches are excluded, retaining their separate freshness guarantees.
New explicit People lookups bypass the collection window and refresh completed
evidence; automatic hydration owners do not. They also reactivate parked owner
records. Normalization merges members into an existing owner request instead of
overwriting its discovery membership, preserving the live owner refresh watch.

Only reference-count filters with an e tag wait for their route's initial visible
page to finish or its first 15-second deadline to expire. Backoff and retries do
not renew this count deferral. Notification p-tag requests are never treated as
count hydration.
Count target
changes still replace the live union; retaining many small live count buckets was
rejected because it increases slots, replies and rotation. Profiles precede counts
at equal priority. Finite follower and ID replies finish or time out instead of
being interrupted by each arriving name; focused unfinished pages can preempt.

State is bounded by existing wants: at most 128 visible views, 6000 authors per
view and 120 keys per bucket. It releases with the last visible owner. A finite
multi-filter envelope remains alive when one logical member disappears; removed
members accept no events. The last member closes it. Existing deadlines still bound unanswered finite requests. Public live envelope
retirement remains an explicit measured boundary below.

## Resumption and limits

An exact copy of an event already verified in the store advances that relay's
matching request watermark. An altered body sharing the same ID cannot advance it.
Duplicates do not earn usefulness credit. Existing event/duplicate/byte counters
retain their meanings. Resumed streams keep their two-second inclusive overlap;
unfinished historical pages still replay their original filter until EOSE.

NIP-11 max_filters overrides inference, capped at eight. A relay advertising
NIP-01 permits two filters when no explicit max_filters is given. This is an
inference from the advertised REQ contract, not conformance proof. Unknown relays
stay at one. Non-rate-limit CLOSED on a multi-filter envelope retries its logical
members with fresh single-filter envelopes and disables inference until transport
removal. Rate-limit responses retain the existing cooldown instead. Overlapping public live wants can share immutable envelopes; each logical filter
retains its own limit, received frontier and completion. Internal, encrypted and
privately selected wants remain independently releasable.

## Rejected duplicate strategies

Seven authors with two disjoint verified outboxes each need 14 connections.
A six- or twelve-connection device cannot provide universal two-cover there.
Dropping uncovered authors or treating reader fallbacks as verified write coverage
would be false. No shared dynamic discovery/allocator/generation implementation
ships in this change.

The proposed time-range fallback was tested with the first answer at 80, 90 and
100, and a second-only note at 95. Requesting only below 80 and above 100 removes
three duplicates but loses that note (4 to 3 recall), and needs two complementary
filters. It was rejected. Neither NIP-11 nor a successful EOSE proves that another
relay has no missing events inside this range. No NIP-77 codec or reconciliation
session ships; an older negentropy advertisement alone is not used as proof.

## Evidence

Native fixtures are engine_cover_{coalesce,filters,lists,resume,safety}_test.rs,
engine_cover_{notifications,refresh,counts}_test.rs. Their
scorecards distinguish actual scheduler frames from rejected strategy simulations.
The original implementation is also run against the same coalescing and duplicate
fixtures when recording the before scorecard; normal gates assert current behavior.

scripts/engine-cover-sample.mjs is manual and excluded from automated gates. It
uses the same public profile, fresh Worker/IndexedDB and three preconnected guarded
transports for each 30-second run. The engine selects its own requests; idle warmed
transports may remain unused. All sockets permit REQ/CLOSE only. Only allowlisted
NIP-11 HTTP is permitted. The profile timer excludes transport warmup in both arms.
The relay set is yabu.me, nos.lol and relay.primal.net; damus failed warmup twice.
Results include visible note IDs, historical unique IDs, wire-kind attribution,
rate-limit notices and simultaneous socket counts. Sequential public samples have
unknown ground truth and are not a controlled latency benchmark.

Raw runs, medians, targets, rejected experiments and gate results are retained in
ignored tmp/cover-public.json and tmp/cover-report.md. tmp/cover-note.txt contains
the owner's one-line Japanese note. No publication, deployment or service change
is part of this work.

The median of three runs per arm is 48 -> 27 REQs (43.8% less), 1028 -> 564 duplicate
wire events (45.1% less), 27787440 -> 14319848 bytes in (48.5% less), and 717 ->
694 ms first screen. All six final windows contain the same 39 verified note IDs;
all runs have three simultaneous warmed transports and zero rate-limit notices.
Bytes out fall 34366 -> 15840. The request, first-screen, visible-note and notice
targets pass; the 50% duplicate-reduction target does not. No public multi-filter
envelope was observed; that gain is established
only by the deterministic fixture (four REQs to two without an explicit cap).

## Q1 candidate: canonical wants and shared public envelopes

Canonical request identity treats IDs, authors, kinds and each tag's values as
sets, while preserving time, search and limit. Ordinary exact-ID wants subtract
retained verified bodies before routing. Explicit relay provenance and internal
remote-proof work keep their independent evidence requirements.

Logical count routes inherit the union of their immutable physical target
buckets. Permutation and the 120-target split no longer rerank healthy readers.
A failed required bucket still opens a recovery slot; new targets never borrow
old watermarks. The recorded 121/240-target regressions changed from two reopened
requests, two replayed events and 862 replayed bytes to zero for each case.

Five overlapping Home/notification/profile wants use five, three or one initial
envelopes for filter caps one, two or eight. The quota fixture retains all 207
wanted events even when Home's newest 200 events belong to one busy person.
Closing a member accepts no further events solely for it and never closes a
surviving member's wire. Focus protection, one rotation cooldown per wire and
single-filter fallback cover the entire shared envelope.

A relay cannot delete one selector from an existing multi-filter REQ. Removed
public selectors can therefore still produce discarded wire traffic while
another selector remains live. This requires a bounded handover before Q1 is
complete; no zero-waste or complete-Q1 claim is made by this candidate.
Twenty focused native planner regressions pass in tmp/q1-planner-focused.log.
Full combined gates and frozen public/native score comparisons remain required.

## Q1 measured retention and physical eviction

Evict whole transmitted envelopes by their most urgent member, unfinished
coverage, live status and resend size rather than BTreeMap insertion order.
An already-sent count bucket is reused when its targets remain a subset of
current wants. Complete short public follower lookups survive hide/reopen for
15 seconds on their original relay and exact filter only (256 retained maximum).
Private, truncated and unfinished replies never create this coverage proof.
The same signed five-pane/32-relay/300-author fixture now moves cold wire
requests 53 to 40, duplicate events 214 to 159, total bytes 515907 to 347028.
Warm bytes move 1116770 to 339094; all seven days move at most 435149 to 352129.
Recall remains 331/331 and simulated first-screen readiness stays 375 ms.
The original rejected 576352-byte Q1 candidate is not shipped. A matched-window
public score and real Worker browser proof remain release gates.
