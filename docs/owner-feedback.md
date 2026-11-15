# Owner feedback: engine

## Purpose

Engine changes for the five owner feedback items and their practical bounds.

## Account relay discovery

The live gap was in discovery, not only adoption. Account lists were requested
only by account-bearing views, missing kinds stopped being requested once cached,
and adopting an owner list removed the bootstrap sockets. Active accounts now
hold three bounded live lookups, one each for kinds 3, 10002 and 10063, on bootstrap/indexer,
imported nprofile hints and owner relays. The same host path covers local keys,
NIP-07 and NIP-46, including restored accounts. Hiding every attached page
releases the
lookup after an explicit visibility hint; a visible account/settings page needs
no feed window to discover its list. Changing accounts releases old wants.
At most eight bootstrap URLs, eight imported hints and eight owner/search URLs
are retained. Discovery-only routes cannot publish. Verified kind 10002 wins,
including an explicit empty list; otherwise valid kind 3 JSON content is used.
Each lookup requests one result so max_limit=1 cannot hide an older list kind.
On single-slot relays, unfinished discovery can interrupt settled discovery;
feeds take priority and can interrupt settled discovery too. Paused requests
resume when slots become available, retaining independent per-kind cursors.
Kind 3 relay JSON remains editable as a public follow list.
Newer lists replace usage without turning indexers into account write relays.

## Authorship

The default client tag is ["client","lkjstr"] on notes, replies, quotes,
reposts, reactions and long-form events. EngineConfig.clientTag=false omits it.
Draft.longForm carries an identifier and optional title for kind 30023. Tags are
prepared in Rust before every signer and exact-event validation is unchanged.
Auth events and account lists do not acquire a client tag.

## Media

Blossom PUT /upload with kind 24242 hash/expiration auth remains first choice;
NIP-96 discovery and multipart upload remain the fallback. An existing kind 10063
list, including an empty one, overrides defaults. Upload waits up to 15 seconds
for a verified list or successful absence lookup before choosing defaults; an
unresolved lookup fails instead of uploading to an unintended server.
With no list, media-server rows and upload policy expose blossom.primal.net, blossom.nostr.build and
nostr.download, in that order. These are choices, not claims of availability or
successful discovery. Server rows stay ok=false until a validated upload works.
No automated test contacts these services. Limits remain four uploads, 20 MiB,
eight attempts and bounded HTTP/signing deadlines. BUD references:
https://github.com/hzrd149/blossom

## Stats contract

The new stats request/reply returns EngineStats. Relay observations include
connection state/since, EVENT frames received, duplicate IDs dropped before
verification, open subscriptions, incoming text bytes, encoded outgoing
send-effect bytes, last transport or
CLOSED error, and smoothed REQ-to-EOSE latency. Missing timings/errors are null.
Counters are session-local and reset when a relay transport is removed.
Totals include retained events, event payload bytes (not IndexedDB or JS heap
size), open relay subscriptions, rows available at subscription open and accepted
network events. These last two counters have distinct units; neither claims an
exact cache hit ratio. Orchestration reports active relays serving at least one
followed author and current request memberships saved by coalescing. It does not
claim full follow-set coverage or an outbox-routing implementation.

## Feed continuity

window.retainAbove=true keeps up to 6000 cached rows above the anchor and loads
up to 200 rows from that anchor downwards. The default bounded window behavior
is unchanged. Returned rows replace the previous window; patches use stable keys.
The caller can retain every preceding row while requesting the next page.
rowAtTime returns the first matching cached event at or before a millisecond time,
with the same descending timestamp/ID ordering; cached=true and absent key/at
mean no cached match. It does not assert remote history is present.

Incomplete windows refill after EOSE without requiring another window message.
Pending feed/history requests can preempt settled count subscriptions, whose
coverage survives and whose live requests resume after the feed page finishes.
The conformance fixture serves 5000 signed rows with four-way timestamp ties,
enforces REQ limits and inclusive until boundaries, and injects duplicate frames.
It checks every retained prefix, uniqueness/order, final complete membership,
rowAtTime and actual stats counters. A relay capping a single timestamp below
its event population can still prevent progress: the Nostr until filter cannot
express an ID cursor. The engine preserves an unknown bottom in that situation
rather than claiming that history ended. Retention is bounded at 6000 rows per
query and the existing 16000 regular/4000 replaceable store caps still apply.

## Validation

Native policy regressions: crates/lkjstr-core/tests/engine_owner_feedback_test.rs
and the engine_feedback_*_test.rs files in that directory.
Browser cases: scripts/engine-feedback.mjs and engine-conformance.mjs.
Gate results are recorded in verification.md after execution. Docker is excluded
because its image/container writes are outside the authorized worktree.
