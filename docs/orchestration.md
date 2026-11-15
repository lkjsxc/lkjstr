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
is terminal except rate-limited responses, which remain pending. Deadline expiry
produces timeouts. Unsolicited OK before sending cannot resolve a publication.
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

The live selector ranks the existing configured routes using cached NIP-65
outbox coverage, first-useful arrival share, EOSE latency, connection failures,
rate-limit cooldown and authentication refusal. A neutral prior prevents small
samples from dominating. A greedy marginal-coverage score values a first copy
more than a second. Ordinary requests retain their two-route fanout and complete
filters. Existing eligible routes stay fixed for an unchanged filter, including
a completed page, so quality updates cannot discard coverage or cursors. New
page filters rank afresh; changed read/search configuration still takes effect.
Channel requests retain their existing larger route fanout. Publication-only
transports never become generic read routes. Explicit view hints supplement
ordinary routes without displacing their page evidence.

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
The manual real-WASM public probe is scripts/engine-orchestration-sample.mjs;
it permits REQ/CLOSE only and is excluded from automated gates.

Deferred cleanly: dynamic author-outbox discovery and a device-dependent global
two-cover planner, persisted relay quality/backoff, keyboard-focus scheduling,
merged multi-filter REQs, and person/event weights for hydration and retention.
Global author-sharded requests need paging evidence keyed by route and shard,
with union completion and stable cursors, before replacing whole-filter routing.
Persisted observations need bounded age-decayed samples and restart-clock tests.
Focus scheduling needs an explicit focused-subscription protocol field. Person
weights should be one account-scoped policy with mute exclusion and separately
validated interaction evidence; retention needs quality/freshness adversarial
fixtures. These are not exposed as partially implemented settings or weights.
