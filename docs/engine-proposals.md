# Engine proposals

## Purpose

Concrete protocol/backend choices for frontend review. The frontend's committed
protocol remains authoritative; these are proposals, not assumed acceptance.

## 1. Extension account discovery

Add a correlated main-thread capability request for NIP-07 getPublicKey,
answered with the public key or a stable failure code. The current sign bridge
already requires a pubkey, so account.add/extension cannot discover the first
account through that bridge. Keep arbitrary signer error strings out of engine
logs. The headless harness proves exact-event signing and relay delivery once
a public key is known; account discovery remains unsupported.

## 2. Bootstrap and relay settings

Add explicit relay configuration to EngineConfig (or a separate configure
message), including read/write flags and search capabilities. Currently it
contains language, heuristics and prefetch only. A reader must be able to pick
relays before loading an account's kind 10002 or signing a relay-list change.
The engine currently bootstraps two existing app defaults; harness builds use
only explicit loopback relays. Preserve per-relay usage flags on relay-list save;
the current action adapter still needs that completion.

## 3. SharedWorker detach and recovery

Agree on a client heartbeat/detach mechanism, including a reconnect signal and
reopening visible queries after worker loss. No healthy silent client should
be expired by an undocumented timeout. Two-tab browser tests prove a single
socket, visibility isolation and release when both clients hide. Abrupt loss
of one port can still retain bounded wants while another keeps the worker
alive. The dedicated fallback needs a Web Locks leader plus BroadcastChannel;
a wall-clock lease can split leadership during suspension or clock changes.

## Query and failure evidence

Keep relaysAsked/Answered and expose failure distinctions for embedded quotes.
The quote union lacks an error state: an absent event after EOSE is different
from nobody answering. Native tests cover two-relay not-found and silent-peer
failure. Partial counts remain lower bounds even after every chosen relay
answers; no finite relay sample proves network-wide completeness.

## List editing and references

Refuse edits until a NIP-02/NIP-51 list is loaded; preserve unknown public tags
and opaque private content. Empty-list creation needs a remote-completion proof
or an explicit create action. Native tests prove refusal before load and
preservation during edits. Multi-language OR filters, NIP-05 search resolution,
addressable/private lists and complete notification grouping remain follow-up.

## Scheduling and measured indexing

Share visible wants and release them promptly. Use stable keys and hold anchors.
The measured 100000-event sparse-author workload improved from 3087.80 ms to
1.88 ms for 100 queries by merging existing author indexes. WASM measurements
are in engine-performance.md. This supports keeping filtering/indexing in Rust
and sending bounded finished windows; it does not prove a cold 100000-row disk
startup. Add disk compaction and that browser benchmark before claiming it.

## Count contract resolution (2026-11-15)

The frontend's protocol 2 remains authoritative. The proposed estimate objects
were rejected during integration. Unknown profile fields are absent; known
numbers use the existing partial flag. No alternate unknown representation.

## Protocol 5 owner decisions (2026-11-15)

Accepted by the frontend owner: another person's Home, bounded local mention
suggestions, explicit device profile requests, validated UTF-16 mention ranges
and kind-0 picture revisions. The frontend protocol.ts is authoritative.
The Rust mirror and mock implement it; see [wishes.md](wishes.md). Relay
selection and prioritization remain outside this change.
## Upload feedback (2026-11-15, accepted in frontend contract)

Upload actions may select one `server`; absent uses the first owner/default
server. Progress optionally includes `server` and `phase` (discovering, signing,
uploading, processing). Upload-specific failure codes distinguish network/CORS,
timeout, payment, discovery and invalid response. Existing byte progress and
result shapes remain compatible. ServerRow.ok records positive upload
confirmation, not a live health check. The frontend owns the additive fields in
protocol.ts. See media-uploads.md for bounds and browser evidence.

## Media server evidence

Additive frontend contract: ServerRow.checked distinguishes unknown from a fresh
required-request verdict; error carries the same translated code as upload.
servers.check retries required NIP-96 discovery or optional BUD-06. Optional
failures stay unknown. Evidence is session-only and shared across subscribers.

## Look corrections (2026-11-15)

Frontend protocol 5 adds optional Stats relay `route` words (reading, writing, both, search, own, unused). The engine derives these from configured relay usage.
Note `Counts.partial` now means an observed full relay page, not an unanswered request; the wire shape is unchanged. Preview failures and
untitled answers project no cards until cache expiry.


## Composer delivery lifetime (2026-11-15)

The frontend-owned Hint gains optional deliveryWatches, at most 128 action req
IDs per client. Existing delivery/result shapes stay unchanged. First success
resolves the action; delivery updates continue while that result is displayed.
Replacing the result or unmounting after settlement releases the listener; detach releases
its namespaced watches. Engine receipts retain the last 32 publications plus
watched results, bounded by 32 clients. Wire delivery includes only attempted
routes and retains relay refusal messages. Timeout means unknown; no protocol
contract number change or new user-facing state is needed.
