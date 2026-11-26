# Progressive relay orchestration - November 19

## Purpose

The existing Rust planner, verified store and Worker effects own this change.
No interface, filter policy, chronological order or storage schema changes.
The posting-echo work remains a separate integration predecessor.

## Readiness and timing

Rows project after bounded verification as they arrive. Network readiness
becomes data after one delivered page, or after 300ms when verified data is
available, without waiting for every relay's EOSE. A failed route cannot
replace an established data state. Unanswered or refused routes cannot prove
empty; successful finite answers, page limits and verification still govern
absence and history.

| Decision | Bound |
| --- | --- |
| Initial ordinary routes | Two complete-filter routes |
| No-data hedge | Third route at 400ms; thin-link prior waits up to 3s |
| Soft first-event bound | 1.5s normally; 4.5s at the 2g prior; owed span remains |
| Public request deadline | 5s per transmitted request |
| Zero-connection startup | Neutral until all attempts fail, or a 10s soft error |
| Private reads | Existing 15s bound |
| Profile coalescing | 50ms, at most 120 authors per batch |
| Physical subscriptions per relay | Existing NIP-11 cap, clamped to 1-8 |
| Finite envelope filters | Existing cap, at most eight |
| Active transports | Existing shared 64-route budget |

Timers wake the engine even when sockets are silent. Slot-queued work is not
expired as though it had been transmitted. Missing bootstrap configuration is
not a failed connection. A still-connecting route survives the response bound;
zero-connection startup reports a soft error at 10s without cancelling it.
A later connection can restore the existing cache/loading phase. Private reads
retain their 15s startup bound. Startup observations cap at 4096 and release
with their owners. First-event latency uses verified
events, including exact verified cache duplicates; the useful-event counter
still credits first insertion only. EOSE is observed once per envelope.
Connection failure, CLOSED, timeout and rate-limit evidence reduces quality;
existing bounded exponential cooldown persists across reloads. A matching verified
delivery after ten healthy connected seconds resets transport failure backoff,
without bypassing an explicit rate-limit cooldown.

The existing effectiveType hint supplies a bounded scheduling prior before four
observed throughput samples exist. It changes no verification or coverage evidence.
Very thin public note pages start at eight records; already transmitted quotas,
explicit IDs, metadata and time-window quotas stay fixed. Two primary routes remain.
Thin links suppress speculative older-page prefetch. See [thin links](thin-link.md).

## Cache and metadata

A cached head renders before network work. Its new head request starts at the
newest matching cached timestamp minus two seconds. A separate finite request
repairs older data through that timestamp inclusively. The logical query keeps
its original bounds. Both paths deduplicate by event ID. Future-dated events
cannot advance the boundary. A short gap does not prove the older range empty.

Route-local full-page cursors and equal-timestamp replay remain authoritative.
A failed or verification-truncated response cannot move the cursor. Reopening
after restart reconstructs repair from retained verified rows; cache membership
alone never asserts contiguous coverage. Arbitrarily backdated events outside
queried history are not claimed to be globally discoverable.

Profiles use a 15-minute TTL and kind-10002 lists a five-minute TTL, measured
from a verified network observation of the exact newest event ID. Disk
restoration does not renew it, nor does a different signed replacement inherit
it. Current lookups finish before freshness can retire other pending routes,
so an older first response cannot cancel a newer replacement in flight.

The compatible quality checkpoint carries at most 512 fresh stamps; live
stamps and retry keys each cap at 2048. A missing/failed lookup waits 30s before
retry. Missing-profile requests retain completed per-relay evidence during that
wait so fallback and conservative absence checks remain possible. Clock
rollback invalidates freshness, and previous checkpoints remain readable.
A visible author can reuse its already-open delivering outbox for kind 0.

## NIP-65 routes

Only the store's verified newest kind-10002 record supplies routes. Author
queries use write roles; reader mentions/replies use the reader's read roles.
Existing strict URL validation and configured read disables apply. Configured
relays remain fallback. Each list contributes at most 64 entries, candidate
URLs cap at 256, and at most 12 transient outbox routes share the transport
budget. Obsolete transient routes are released with their remaining owners.

Visible bounded author discovery runs as low-priority work on existing
connections. Newly discovered outboxes may join an unfinished fallback page
without erasing its cursor. Filters remain complete; no global author-sharded
two-cover guarantee or automatic traffic reduction is asserted.

## Prefetch, cancellation and compatibility

Visible-note reply/count hydration, cached-name refresh and at most one older
page near a visible window's end are low priority. Near-end means within
40 retained rows. Prefetch cannot open an otherwise disconnected socket.
It keeps its owning view identity so an incomplete foreground page, including
verification debt, still precedes background work.

Profile buckets and compatible finite filters reuse existing sockets. Fresh
wire identities fence late cancelled responses. EOSE closes one-shot envelopes
promptly; cancellation releases the last owner. Existing client namespacing,
live recovery, mutes, anchors, replaceable ties and signed verification remain.

Optional relay diagnostics add firstEventMs, requestUses and readTimeouts.
Existing quality, EOSE latency, useful/event/duplicate counters remain. Uses
count physical REQ envelopes, not logical filters; session uses reset on reload.
Inactive routes without a retained transport observation report null counters.
These are additive engine fields and introduce no UI controls.

## Verification

Native engine_relay_progressive_test cases cover the 300ms partial-data and
one-page paths, silent-socket hedge, useful-data suppression, one-shot close,
late cancellation and quality restart. Startup cases cover delayed bootstrap,
a seven-second handshake, late recovery after the ten-second soft error,
definitive failure, owner release and separate public/private deadlines. Cache-gap tests cover
inclusive tied boundaries, independent older repair, future timestamps and
failed restart fetches. Outbox cases cover roles, fallback, new-list discovery,
newest replacement, invalid hints and explicit read-disable precedence.

The real Worker relay fixture withholds EOSE to exercise the 300ms data rule,
400ms hedge, five-second timeout, partial success, finite CLOSE and cancellation.
Signed author metadata keeps the normal Global policy in force. A fresh second
context prevents cached rows from substituting for the timed network arrival.
A third context opens before relay configuration to reject an initial failed
phase and verify recovery on that same view. Reports bind both the loaded
WASM and fixture script hashes.

Metadata cases cover TTL, clock rollback, replacement identity, cache renewal,
bounded retry, immediate cached-name display and already-open outbox reuse.
Existing pressure replay, route recovery, count completion, profile absence,
private lifetimes, immutable envelopes, dual-client and own-note/anchor suites
remain required. Full native/WASM, frontend and real-Worker release commands
are unchanged. Live evidence is separately artifact-bound; previews and
unavailable public responses are never counted as deployed successes.
