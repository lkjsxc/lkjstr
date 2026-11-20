# Read orchestration follow-up

## Purpose

Account-aware information weighting and its orchestration, observable in Stats.
This is the follow-up to [orchestration.md](orchestration.md). Chronological feed
order is unchanged. Only the validated pieces below ship.

## Route-local history

A request retains both its logical page and its transmitted route filter. Advancing
an inclusive union cursor advances each successful route to its own oldest event.
A short successful route stays exhausted while another route continues. Explicit
seeks do not inherit this optimization. Interrupted filters retain page evidence;
failed, truncated and nonadvancing timestamp-tie pages never prove exhaustion.
The state is bounded by current wants and released with the last owning view.

The November 19 extension adds bounded signed author-list discovery and NIP-65
routes to configured fallback, with two initial complete-filter routes and a
timed third-route hedge. Inclusive cache-gap repair preserves this cursor
evidence. Author-shard reassignment and a global 12/6-connection two-cover
budget remain unimplemented. No new relay-selection setting is exposed.
See [relay-orchestration-20261119.md](relay-orchestration-20261119.md).

## Durable relay quality and throttling

The Worker stores relay observations separately from event tuples and restores them
before queued inputs. At most 64 normalized URLs survive; snapshots are capped at
256 KiB on input. Received/useful samples cap at one million, age-decay hourly
across reloads and expire after seven days. Session traffic counters start at zero.
Connection failures and request cooldown persist as remaining durations, capped
at 120 seconds. Forward clock jumps consume the remaining delay; backward jumps
retain only that bounded duration. Profiles cannot bypass a rate-limit cooldown.

CLOSED and NOTICE recognize rate-limited, too many requests and slow down. Repeated
refusal increases cooldown from 30 to 120 seconds. Publication retry also observes
this cooldown. Live streams already accepted by a relay continue receiving.

Finite requests share immutable REQ envelopes. Explicit NIP-11 max_filters wins,
capped at eight. A NIP-01 advertisement permits two when no explicit cap exists;
unknown relays use one. A rejected multi-filter envelope retries as single filters
and disables inference for that transport. max_limit applies independently to each
filter; subscriptions count envelopes. Matching events split into logical requests;
one EOSE completes the union. Removing a finite member keeps an envelope while
another member owns it, avoiding replay. Removing the last member closes it.
Fresh wire IDs isolate replacements from late cancelled replies. Live streams stay
independent. Current traffic measurements and limitations: [cover.md](cover.md).

## Work and information weights

Hint.focusedSub identifies the subscription in the keyboard tile. Shared clients
namespace and validate it against visible subscriptions. The request order is
focused, visible, notifications/owner records, visible details, then prefetch.
Settled owner refresh tails yield to unfinished work. Incomplete focused pages
cannot be interrupted by hydration. Closing/hiding releases wants. A shared
profile batch stays in flight while any of its authors is still wanted, avoiding
starvation during rapid arrivals; each batch is at most 120 authors. The only window
manager change binds subscriptions to their existing view element.

One account-scoped policy assigns self 64, follows 32, verified reply/reaction
counterparts 16, follows-of-follows 8 and unknown people 1. Public and decrypted
private mutes always yield zero. Interaction evidence requires a retained verified
target event; a p tag alone cannot earn weight. Graph entries cap at 12000, plus
2000 interaction targets and the account. Event weights also honor word/thread
mutes. The policy informs route marginal coverage, request ties and hydration
exclusion. Device-wide refresh requests without a reader use neutral weight 1.
PersonRow.weight exposes the account-scoped person weight. There is no composer mention list in this
checkout to reorder. Retention remains unchanged.

## Stats and channels

Stats adds sortable route-rule marks, verified followed-author coverage and relay
quality. Its bounded request table (256 logical requests) shows purpose, envelope,
weight, received count and completion marks. Missing engine fields remain dashes.
Coverage requires a signed write-relay list and an active matching request; it is
not inferred from merely contacting a relay. Both string tables name the columns.

Channel discovery asks configured read or search routes for kinds 40 and 41 in
separate filters. Kind-41 references seed missing creation lookups; only a verified
kind-40 event creates a discoverable channel and only its creator can edit metadata.
Creation lookup does not inherit a note's date window. Existing creations are not
requested again by ID. Existing 1000-candidate and 120-ID batch bounds remain.
One extra kind-41 stream per selected route is the explicit discovery cost.

## Deterministic measurements

| Fixture | Before | After | Invariant / cost |
| --- | --- | --- | --- |
| Asymmetric route tails | 6 REQs | 5 REQs | 4/4 unique events; 2 routes |
| Four finite filters, max_filters=4 | 4 REQs | 1 REQ | 4/4 results; 1 connection |
| Two restart cooldowns | 2 premature REQs | 0 | Both recover after the bound |
| Focus versus metadata, one slot | Focus second | Focus first | 0 REQs after close |
| Weighted candidate selection | Uniform tie | Follow preferred | Mutes 0; account leaks 0 |
| Kind-41-only search index | 0 rows | 1 verified channel | Extra discovery stream |
| Request-purpose fields | 0 | Every sampled request | At most 256 rows |

The original 32-relay/300-author read and publication scorecards remain regression
gates. These fixtures do not establish global two-cover or public network recall.
The historical public comparison used fresh contexts, REQ/CLOSE-only guards,
three allowlisted relays and no account/signer. Public
samples are sequential, not a controlled speed benchmark. Results and the final
gate record live in ignored tmp/outbox-report.md and tmp/outbox-public.json.

```sh
git show 8e8733596086e5dbdd75e8cb3be5b1af27113134:scripts/engine-outbox-sample.mjs
```

The one public comparison returned 121 -> 127 verified channels and no rate-limit
notice. In the 30-second profile phase REQs increased 31 -> 39 and duplicate wire
events 562 -> 1083, while first screen improved 3098 -> 1531 ms (40 notes each).
Successful socket opens differed 2 -> 5; neither causality nor a traffic reduction
is established. No multi-filter envelope was observed. The owner's empty-finder
and too-many-requests failures remain unreproduced on the sampled relays.

## Designs left out cleanly

- Device-bounded author two-cover: needs per-author shard-generation evidence,
  bounded verified list discovery and a shared connection allocator across views,
  hints and publications. Route-local cursors alone do not prove safe reassignment.
- Stable live count buckets: keeping small completed batches reduced replay during
  arrival but occupied slots and caused rotation after arrival stopped. That
  experiment was removed. Finite envelope merging does not solve live count churn.
- Weighted retention: needs adversarial quality/freshness fixtures before replacing
  current chronological store caps. Exposing person weight does not change eviction.

No placeholder success, synthetic public channels or claimed two-cover is exposed.
