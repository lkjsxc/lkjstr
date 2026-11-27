# Fetch orchestration for chronological views

## Purpose

Home can receive a recent page from one relay while another is still connecting.
Older cached rows, including the account's own history, can then look like the
whole feed. The list and time rail need one chronological index whose extent is
earned by the sources serving that view. An event's signature establishes who
signed it. A successful request establishes how far one source answered.

## Sources and evidence

A source is a relay plus a canonical logical filter under the current query and
read authority. A finite attempt adds the actual wire generation, time bounds
and limit. Filters sharing a socket or REQ still have separate evidence. Home
uses the verified follow graph and includes the account. Their Home uses the
target's graph and includes the target. The reader's policy applies to both.
Global, hashtags, search and channels use their eligible relay/filter sources.
Notification overlays have their own filter family. Explicit moments, private
views and single-author views keep their existing request semantics.

Use half-open second ranges internally and convert to inclusive Nostr bounds.
A clean EOSE with verification drained closes the exact interval of a short
page, including an empty one. A full page closes only the newer side of its
oldest admitted timestamp. Continue inclusively at that second and count IDs
once. A full nonadvancing second leaves a gap. Reconnect `since` limits, relay
clamps and canceled or replaced envelopes cannot certify the omitted interval.
Before EOSE, ordered verified arrivals can inform scheduling and the live
preview. Queue loss, timeout and CLOSED leave the relevant coverage unknown.
EOSE is a statement about one relay's response at one time. Relay silence,
absence on one relay and a cache hit supply different information.

Track a bounded set of distinct verified signers per range, attributed to the
wire source that supplied the event. A relay contributes author coverage when
its entire applicable filter interval settles, including for authors whose
response was empty. Settled negative evidence for a follow requires an eligible
route queried for that author. An author with no known outbox route stays owed.
Multiple copies of an event, reposts of one original and cache-only warm rows
cannot increase the contributor count. Use the signed author of the displayed
content for diversity and the filter's actor for route accounting.

## What the reader can see

Advance a single contiguous historical boundary from the head. In Stage 1 a
settled page must meet the current boundary, and the next extension spans at
most 24 hours. Home with three or more other eligible follows requires three
distinct non-owner signers of matching notes in that extension. A smaller
graph with other eligible follows needs each of them. Historic admission stops
at the oldest contributing note. Owner-only subscriptions can use the settled
interval once the follow list is known. Pending follow discovery keeps Home
in its recent preview. Other broad merged queries use three distinct
contributors where their scope allows them. A channel or inbox can use
a settled answer to its specific filter, even when few authors match.
Search keeps direct access to matching cached notes. Stage 2 adds author-group
answers and empty gap repair.

Take the deepest contiguous range that meets the policy. A deeper isolated
success stays behind a gap. Owner and prolific authors can appear in covered
history, without their volume changing what qualifies. Keep a recent preview
bounded at view open for locally signed, live and cached rows, including offline
startup. Preview rows and covered history use the same row keys, timestamps,
policy and ordering. Rail ordinals, jump anchors and history refill consume the
same admitted chronology as windows. If the shared index changes while a drag
is in progress, retain the existing drag-map behavior. A published map cannot
offer anchors beyond its admitted span.

Keep the 24-hour preview open while answers arrive and apply the existing
bounded request waits. When visitor Global has no matching recent note, its
preview extends to a day before the newest matching older note, within any
explicit time filter. Keep that range admitted while the view is open.
Render the first verified Home preview immediately and batch later arrivals. Four seconds of unanswered work no longer exposes a
cached tail. A timeout leaves the old range owed, and later successful work can
extend the span. Hold already shown, still-valid rows across route rotations.
Follow or mute changes and event removals can invalidate covered rows.
Snapshot replay uses the same policy identity and the preview age supplied by
the engine, so it cannot reintroduce unknown history on reload.

The [extension signer orchestrator](signer-orchestrator.md) has its own slot
and rate budget. It uses the same demand, weight and cancellation model
without requiring a signature to read or paint public rows.

## Spending connection and bandwidth budgets

Schedule demanded work before speculative work. Start with class weights 8, 4,
2 and 1 for the visible window, near prefetch, backfill and background. Treat the
first gap blocking a visible extension as visible work. Within a class, prefer
gaps closest to the reading anchor and use bounded source and author-group
weights. Favor distinct uncovered authors and useful results per byte. Clamp
weights, rotate equal candidates, and age ready work so one busy relay or author
group cannot monopolize the next quantum. A ready source with no relay slot
keeps its turn without blocking another relay's eligible work.

Enforce the common transport cap, relay cooldowns, NIP-11 subscription/filter
limits and per-envelope page limits before dispatch. Estimate in-flight bytes
from the sent limit and observed event size. Charge the estimated cost when
admitting a request and reconcile using actual received bytes. Throughput and
RTT determine the next budget, with a conservative cold start. Thin links keep
the first visible page small, reuse sockets and defer hedges. Suppress optional
prefetch while saturated, offline, hidden, saving data or awaiting a first
publication acknowledgement. Leave existing correctness work for writes,
deletions, account dependencies and verification repair ahead of speculation.

Retain overlapping logical wants across views. When a view moves, hides or
closes, remove its interest and cancel an envelope only after its last owner
releases it. An already settled interval can survive cancellation if its query,
authority and cache generation still match. Bound it by time and count. Keep
body retention under GDSF. If reclamation invalidates covered rows, feed the
existing eviction fence back into the gap queue. Bytes or profile retention
must be measured separately from answer coverage.

## Inline feed images

The browser owns this lane because it can see image box geometry and issue
native image requests to public media hosts. The lane schedules up to four
active inline image loads per page, independent of the Worker relay slots.
It admits boxes within 1.5 viewport heights, nearest first. Fast scrolling
pauses admission until movement slows or the viewport has rested for 140 ms.

The native loader shares attempts across tiles. Leaving 2.5 viewport heights
cancels pending demand, and the last consumer releases the browser request.
A row redraw gives the replacement boxes a short window to take over a request.
Loaded images beyond 4.5 viewport heights are released after 240 ms. Hiding or
closing a feed drops its demand and mounted images. The original link and
reserved box stay in place. A request deadline keeps a stalled host from
holding a slot indefinitely.

Project lesson (frontend media maintainer): compare settled renderer private
memory on the same scroll and cache policy. Fewer image elements or smaller
image cache counters can coincide with more process memory.

## Implementation and release steps

1. **Use one covered chronology and fixed weights.** `engine/even_history.rs`
   supplies the admission boundary for `engine/window_selection.rs`,
   `engine/history.rs` and `engine/wire/timeline.rs`. It replaces the temporary
   four-second release of arbitrary cached tails. Read settled route evidence
   from `engine/network_horizon.rs` and its page frontiers. Keep the existing
   selector in `engine/read_plan.rs`, physical limits in `engine/network_tick.rs`
   and link sizing in `engine/network_optimizer.rs`. Rank the ready public page
   candidates with explicit author groups using deterministic class and source
   weights. Prove a delayed-source replay keeps an
   older owner-only cohort out of both projections and admits a diverse page
   when settled. Record oldest-15 author shares, first note time, and list/rail
   anchor agreement. Check warm replay on the same fixture.
2. **Make gaps drive finite routing.** Keep bounded intervals and author-group
   evidence beside `engine/network_paging.rs` and `engine/network_frontier.rs`.
   Feed their outstanding work to `engine/network_plan.rs`; it replaces
   speculative history order and the `engine/network_cache_gaps.rs` inference
   that a cached timestamp can seed a repair. Reuse `engine/read_plan.rs` for
   admissible routes and actual observed costs. Add deficit rotation and shared
   byte reservations beside `engine/network_optimizer.rs` and `optimizer/`.
   Measure nearest-gap settlement, requests per new eligible author and bytes
   before the first note in the shaped thin-link fixture. Include one-slot,
   rate-limited, silent and moving-view controls.
3. **Carry coverage through retention and communicate gaps.** Bound saved
   interval summaries against reusable query identity and membership. Join
   `engine/cache_retention.rs` and `store/retention.rs` eviction evidence to the
   shared index, with normal signed-deletion authority and no second body store.
   Expose provisional, settled, owed and unavailable states for Claude to
   design. Measure mounted rail anchors after warm reopen under identical
   IndexedDB pressure, including surviving names and exact row overlap.
4. **Evaluate adaptive weights locally.** Feed bounded candidate features and
   outcomes to a small contextual bandit or predictor beside `optimizer/`.
   Inputs include delay to useful progress, verified new authors, unique bytes,
   retries and abandoned work. Log bucketed local scalar features, predicted
   order and eventual outcomes in a bounded diagnostic ring without event IDs,
   pubkeys or private routes. Run in shadow mode before enabling any control.
   Compare fixed-weight and learned orders on matched replays, then measure
   first note, oldest range author share and bytes with a frozen cohort. Clamp
   the output and fall back to fixed weights on cold start, insufficient data,
   disable or repeated regression. The model may order eligible work. Coverage,
   transport caps, privacy and cancellation remain enforced by the engine.

Project lesson (engine/cache maintainer): Nostr answer coverage, resident
membership and rail ordinals must be measured on the same query and fixture.
Observe first readable rows separately from how representative the aged edge is.
