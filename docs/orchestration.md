# Relay orchestration

## Purpose

Engine routing, delivery bounds and measurements for the 2026-11-15 change.
The pure publication planner and request selector produce testable route plans;
the Worker executes effects. Feeds remain chronological.

## Publishing

The signed author's verified kind 10002 write routes override configured fallback
write routes. Up to 12 distinct own routes are selected. Replies also use retained
parent origins and signed e-tag relay hints; addressed kinds 1, 6, 7, 16, 42 and
30023 use recipients' verified read routes, up to two per person and eight extra
routes including reply context. Duplicate URLs consume no extra connection.
People-list p tags are not recipients: changing mutes/follows does not contact
those people's inboxes. Kind 10002 updates include new and previous outboxes.

Up to 32 recipients are considered. Missing kind 10002 lists get independent,
limit-one lookups on up to two existing chosen routes while own delivery proceeds.
A write-only configuration can use its chosen write routes for these lookups.
Unresolved recipients remain counted in recentPublications; absence is not a
successful delivery. Cached inbox lists are used immediately. Relay discovery
cannot exceed the publication's deadline or introduce unrelated relay URLs.

Each job has a 30-second deadline. Offline destinations connect with existing
exponential connection backoff. Pending EVENT frames retry every five seconds;
reconnect clears the send marker. The first positive OK resolves success once;
remaining destinations keep attempting and emit delivery updates. A negative OK
is terminal except rate-limited responses, which remain pending. The 30-second
wait is unchanged: measured public OKs needed less than two seconds. Deadline
expiry means timeout/unknown. Late OKs still correct the record; true duplicate
OKs are acceptance. Sent evidence survives reconnects independently of retry
markers. Failed socket sends are removed from the composer list unless an
earlier send succeeded. Unsolicited OK before sending cannot resolve a publication.

The composer count includes only destinations actually sent an EVENT. The first
action result does not end its delivery listener. Frontend hint.deliveryWatches
retains one result per mounted composer (up to 128 per client, 32 clients);
replacement, unmount after settlement and detach release it. Engine receipts retain the last 32
publications plus displayed results. They contain no event bodies; every route
collection is bounded by the publication plan (12 own plus eight context/inbox).
Recent history retains updated states and bounded refusal messages. Timeout
receipts remain pending/unknown in aggregate engine counts; Stats columns and
wording stay unchanged.

A verified copy from an attempted relay also confirms delivery. A timeout gets
at most one finite ids request, seven to ten seconds after the wait ended, only
on an already-open socket with a free subscription slot and no cooldown. No new
connection is opened for confirmation. Already-open sent sockets stay wanted
through the opportunity/check, at most 15 seconds after waiting. The check closes
on an event, EOSE, CLOSED,
five-second expiry, disconnect, deletion or receipt release. An earlier verified
copy suppresses it. Echoes during the wait are remembered without resolving
the action before its OK; they confirm an otherwise unanswered result at expiry.
Unsent or unrelated rebroadcast relays never change the count.
Channel creation still requires both its creation event and joined-list success.

Limits: 64 simultaneous publications and 64 active transports including the
existing configured read routes. Capacity exclusions are explicit. Initial plans
retain up to 2240 valid candidates (128 own candidates for list transitions,
32 people x 64 list entries and 64 context URLs). Own, per-person, inbox and
capacity caps are retained with reason codes. URL length is at most 2048 bytes.
Invalid addresses are rejected; secret-bearing URLs are never candidates.

Deletion cancels outstanding original sends/discovery to prevent late fanout.
It reuses attempted destinations, including missing acknowledgements, plus
current outboxes and retained event origins. A FIFO ledger retains at most 2048
authored route sets, with at most 64 routes each and a 4 MiB URL byte bound. It is
saved in IndexedDB with event persistence and restored before queued actions.
Pending sends do not resume after Worker termination. After ledger eviction,
complete historical delivery destinations are unknown; no guarantee is made for
those older deletions. Recent Stats history is session-only and bounded to 32
publications. Transport resources are released after their remaining wants end.

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
