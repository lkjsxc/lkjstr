# Relay orchestration

## Purpose

Engine routing, delivery bounds and measurements for the 2026-11-15 change.
The pure publication planner and request selector produce testable route plans;
the Worker executes effects. Feeds remain chronological.

## Publishing

The signed author's verified kind 10002 write routes take priority over configured
fallback writers. Public notes also use retained parent origins, signed relay
hints and up to 32 recipients' verified read routes. Explicit write opt-outs and
read-only routes are respected. A note plan admits up to 128 distinct destinations
and records capacity exclusions. Other kinds retain the existing own and inbox
planning limits. Relay-list edits include the new and previous outboxes.
Missing lists get limit-one lookups on up to two selected routes while sends proceed.

Publications reuse open and already-connecting reader sockets. Up to 12 new
publication handshakes run at once, independently of the 64-reader pool. Queued
jobs rotate through the free slots. Each admitted note route has 10 seconds to
connect and 8 seconds from the first EVENT send for an OK. A route in known
backoff that cannot meet its deadline times out early. A disconnected socket
retries with the existing bounded connection backoff and the same event id.
On a stable socket, an unanswered note gets one resend during its OK window.
Rate-limited note routes retain their negative OK and observe relay cooldown.

Only the first matching positive OK on a sent note frame resolves success.
Transport sends and verified echoes have no effect on note acceptance. The
remaining routes continue and publish receipt updates. Initial delivery and
discovery are bounded by 30 seconds, with accepted notes and deletions allowed
up to 120 seconds for later waves. A late positive OK can update a retained
timeout receipt. Other kinds also retain verified-echo confirmation and at most
one finite ids check on an open socket.

The composer counts relays that received a frame. Stats retains the last 32
plans, including rejected, timed-out and unattempted destinations.
The existing delivery watch retains results while a composer displays them.
Receipt tracking retains no event bodies. Channel creation still requires both
its creation event and joined-list success.

Deletion cancels the original note's outstanding sends and discovery. It reuses
the original routes, current outboxes and event origins. The persisted FIFO
ledger keeps up to 2048 authored route sets under a 4 MiB URL byte bound and
includes destinations without an ACK. The Worker restores it before queued actions.

## Reading and freshness

The selector ranks configured fallback and query-scoped signed NIP-65 routes
using verified first-event/EOSE timing, useful arrival share, connection errors,
CLOSED responses and cooldown. Author notes use advertised write roles; mentions
and replies use the reader's read roles. Explicit read disables remain binding.
Initial ordinary fanout is two; a 400ms no-data hedge may add a third. The 1.5s
soft bound frees a primary slot while retaining owed route-local history.
Public read waits end at 5s. Private read lifetimes remain unchanged.

Verified rows render as they arrive. A delivered page or 300ms with verified
data settles the usable state independently of slow EOSE. Empty/history evidence
still requires successful answers and drained verification. Cache rows are
immediate; fresh gaps use since with a two-second overlap plus an inclusive
until repair. Neither failed reads nor cached membership prove exhaustion.

Visible profile hydration batches for 50ms, starts on a delivering route and
falls back after termination. Cached metadata has observation-based TTLs
(15min profiles, 5min relay lists), background revalidation and bounded durable
stamps. Background replies/counts, nearby older pages and cached-name refreshes
use existing sockets and yield to explicit work. Finite envelopes, cursor and
cancellation rules remain in [cover.md](cover.md). Current bounds and deterministic
proofs are in [relay-orchestration-20261119.md](relay-orchestration-20261119.md).
Complete filters remain intact; author-sharded global two-cover is not claimed.

Every saved device account, up to 32, requests kinds 0, 3, 10000, 10002 and 10063
at startup independently of cached records or open account views. Successful
sign-in/account switching resets that account's discovery cursors. Each kind and
author has its own limit-one request, respecting max_limit=1 relays. Pending
owner records can rotate after a feed's EOSE on a one-slot relay; completed
owner discovery does not repeatedly preempt feeds. Hiding releases discovery;
removing an account releases its wants. Routes remain bounded to existing
configured/discovery capacity. Profile batches cannot absorb owner refreshes.

## Stats and protocol

Existing per-relay event, duplicate, byte, subscription and latency observations
remain. Additive optional publication fields count planned, accepted, failed,
pending and excluded destinations over the last 32 publications. Stats aggregates
all destinations once into a URL-keyed map, including skipped candidates, and
counts open subscriptions once before projecting relay rows. The UI adds
three sortable numeric groups: accepted/planned, pending/failed and exclusions
by own/inbox/capacity cap. A local horizontal table scroller preserves narrow
views. Both string tables supply headings; no other view or CSS rhythm changes.
recentPublications exposes id, kind, at, unresolvedRecipients and destinations
with url, rule, state and optional reason. Rules are own/inbox/reply/delete;
skipped reasons are own-cap/person-cap/inbox-cap/capacity. Wire delivery messages
keep their existing states; detailed exclusions are Stats records.

## Measurement and remaining design

The deterministic read fixture has 32 candidate relays and 300 followed authors.
Old versus new: obtained 200/300 versus 300/300; first 50 unique rows 1200 versus
100 ms; connections 2 versus 2; REQs 2 versus 2; duplicates 200 versus 100;
event payload bytes 204800 versus 204800. This is a controlled overlapping-
coverage example, not a general network benchmark or global two-cover proof.

Publication simulation uses 12 outboxes and eight inboxes, with connection and
send failures. Accepted destinations rise from 2 to 20; first success stays
100 ms. Connection attempts rise 4 to 22, EVENT frames 3 to 21, and payload bytes
1137 to 7959. Broader required delivery necessarily sends more data; this is an
explicit cost, not a Pareto improvement across all read and write metrics.
The historical real-WASM public probe permitted REQ/CLOSE only.

```sh
git show 8e8733596086e5dbdd75e8cb3be5b1af27113134:scripts/engine-orchestration-sample.mjs
```

The read follow-up now ships route-local cursors, durable cooldown/quality,
finite multi-filter envelopes, focused work, account-scoped weights, request
purposes and channel metadata discovery. Exact scope, scorecards and remaining
designs: [outbox.md](outbox.md). Dynamic author two-cover, live count-bucket merging
and weighted retention remain out of the product.
