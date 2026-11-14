# Engine

## Purpose

Rust/WASM owns relay traffic, verification, storage, finished view models and
protocol actions. The TypeScript frontend owns pixels and the NIP-07 bridge.
The retained Leptos app imports only browser adapters during cutover.

## Build and entry

Source the local cache environment (tmp/env.sh here), then run
`sh scripts/engine-build.sh`. Generated web-target wasm-bindgen output is in
`tmp/engine-pkg`. Initialize that module inside a Worker and retain `start()`.
Call `stop()` before disposing the handle. The `worker` Cargo feature enables
entry exports; the old app disables it to avoid a duplicate start symbol.
The product requires only generated loader JavaScript plus frontend bootstrap.

`start_shared()` uses the same host with MessagePorts, one engine per origin
and worker name. Queue connect events in the bootstrap while WASM initializes,
then forward them to the installed onconnect handler. Both entries own socket
callbacks, cancellable timers and IndexedDB, with explicit stop/drop cleanup.

## Authoritative contract

The frontend contract is `web/src/engine/protocol.ts` on web/next-20261114.
It arrived during implementation. `lkjstr-core::engine::wire` mirrors its
`t`, `a`, `k` tags, flat query filters, millisecond timestamps, typed rows,
key-based patches, signer JSON strings and correlated action results.
`serde-wasm-bindgen` converts structured-clone values directly, without a JSON
round trip for each row. Unknown messages are ignored as the contract requires.
Internal scheduler types remain separate from the transport contract.

`open` delivers cached rows and registers wants. `window` holds an anchor with
bounded surrounding rows; top windows follow arrivals. Patches batch every
75 ms. `close` and visibility hints release wants. Specialized rows cover
profiles, people, notifications, mutes, relays and diagnostics. Read-only lists
currently support public people entries; private list decryption is pending.

NIP-07 signatures must match every requested field, ID and signature. Requests
expire after 60 s. Publications report per-relay delivery and one final result.
Loaded-list edits preserve opaque private content and unknown public tags.
An absent cached list never authorizes overwriting a remote list.
Unsupported actions return explicit failures, including uploads and account
creation/import; local and remote signer lifecycle remains outside this run.

## Ownership across tabs

Shared clients namespace sub/action/sign IDs internally. Each has its own wire
session; results and signer requests return only to the originating port.
Visibility is the union of visible wants across clients. Hiding one tab does
not close another tab's requests. Explicit close/hints release work.

There is no unagreed heartbeat timeout: a quiet healthy client must not expire
merely because the interface sends no messages. Abandoned-port cleanup needs
an agreed detach/heartbeat message; until then, abrupt loss of one client can
retain its bounded wants while another client keeps the SharedWorker alive.

Where SharedWorker is unavailable, an exclusive Web Locks leader should own a
dedicated engine and forward messages through BroadcastChannel. Followers must
not open sockets before obtaining that lock. This fallback election is designed
but not implemented; separate dedicated Workers still duplicate work.

## Network and bounds

The pure core receives explicit time and emits Connect/Disconnect/Send effects.
Socket callbacks parse bounded frames and enqueue verification; timer slices
verify at most 32 events, then update indexed storage and finished rows.
The queue holds at most 4096 events and 8 MiB of payload. Memory retains 16000
regular and 4000 replaceable events, with a separate 64 MiB payload bound.
These byte counters exclude allocator/index overhead and are not RSS estimates.

There are 128 views, 64 pending signatures/publications, at most 301 internal
window rows, depth-two quotes and at most 4096 segments per note. The wire caps
window requests to 100 before and 200 after. At most eight relays are configured;
reads choose two and publishing chooses three. Identical filters share work.
Each relay has a request cap and rate spacing. NIP-11 can lower request/limit
caps. EOSE latency, useful events, failures and last arrival are measured.
Socket and per-subscription watchdogs reconnect/resubscribe with timestamp
overlap and exponential backoff. Timeouts settle without killing live feeds.

Production bootstrap uses nos.lol and relay.damus.io from the retained app's
existing defaults. Harness builds have no public bootstrap relays.
The contract lacks explicit bootstrap-relay configuration; see proposals.

## Persistence

Worker-safe IndexedDB uses `lkjstr-wasm`, schema 1: events are
`{id, created_at, raw}` with a created_at index; kv holds opaque values.
Writes resolve on transaction commit and retry from a bounded 20000-event
buffer in batches of 500, no more frequently than every 1.5 s.
Startup reads only the newest 2000 events and verifies them incrementally.
NIP-05 requires exact-key HTTP evidence, redirect rejection and a 64 KiB body
limit; metadata replacement invalidates verification. No secret keys appear
in rows, diagnostics or fixture output.

Compact persistence, disk pruning, persisted accounts and cold-start testing
with 100000 physical rows remain unfinished. A 100000-event in-memory benchmark
is measured separately and is not presented as a disk-startup result.

## Harness

`CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4 cargo test -p lkjstr-core` runs native
policy/contract tests. For the headless Worker harness:

```sh
LKJSTR_ENGINE_HARNESS=1 sh scripts/engine-build.sh
node scripts/engine-harness.mjs
```

The harness feature adds simulated-time and benchmark exports; product builds
omit them. The existing fake relay is hosted on a fresh loopback WebSocket.
Tests cover real WASM/IndexedDB, NIP-07, visibility, cache boot, three simulated
idle hours then resume, two-tab SharedWorker ownership, and runtime benchmarks.
See [measurements](engine-performance.md) and [verification](verification.md).
