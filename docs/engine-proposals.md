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
