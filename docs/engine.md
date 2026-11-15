# Engine

## Purpose

Rust/WASM owns relay traffic, verification, storage, finished view models and
protocol actions. The TypeScript frontend owns pixels and the NIP-07 bridge.
The only interface is web/; crates/lkjstr-engine-worker is the Worker host.

## Build and entry

Run `sh scripts/engine-package.sh` for the frontend-loadable package, described
in [engine-package.md](engine-package.md). For raw bindings, run
`sh scripts/engine-build.sh` after setting the local cache environment. Generated web-target wasm-bindgen output is in
`tmp/engine-pkg`. Initialize that module inside a Worker and retain `start()`.
Call `stop()` before disposing the handle. The Worker owns its WASM entry;
the harness feature only adds test-control exports.
The product requires only generated loader JavaScript plus frontend bootstrap.

`start_shared()` uses the same host with MessagePorts, one engine per origin
and worker name. Queue connect events in the bootstrap while WASM initializes,
then forward them to the installed onconnect handler. Both entries own socket
callbacks, cancellable timers and IndexedDB, with explicit stop/drop cleanup.

## Authoritative contract

The frontend contract is this worktree's `web/src/engine/protocol.ts`. `lkjstr-core::engine::wire` mirrors its
`t`, `a`, `k` tags, flat query filters, millisecond timestamps, typed rows,
key-based patches, signer JSON strings and correlated action results.
`serde-wasm-bindgen` converts structured-clone values directly, without a JSON
round trip for each row. Unknown messages are ignored as the contract requires.
Internal scheduler types remain separate from the transport contract.
The Worker reports protocol 2. account.key exports a held local secret as nsec
only on explicit request; external/read-only signers return unsupported.
Account input/output Debug implementations redact payloads. Private account
storage is separate from public diagnostics and telemetry.

`open` delivers cached rows and registers wants. `window` holds an anchor with
bounded surrounding rows; top windows follow arrivals. Patches batch every
75 ms. Hydration follows the current bounded window. Advancing its cached tail
requests one older inclusive `until` page alongside the live head; only short
EOSE pages from every selected relay establish the remote end. Full pages with
nonadvancing tied timestamps remain unknown. `close` and visibility hints
release wants, historical pages and connecting sockets. Specialized rows cover
profiles, people, notifications, mutes, relays and diagnostics. Read-only lists
currently support public people entries; private list decryption is pending.

NIP-07 signatures must match every requested field, ID and signature. Requests
expire after 60 s. Publications report per-relay delivery and one final result.
Loaded-list edits preserve opaque private content and unknown public tags.
Relay-list saves preserve read/write markers and reject disabled entries.
Finished note content derives hashtag and NIP-19 mention tags before signing.
An absent cached list never authorizes overwriting a remote list.
Local account lifecycle, NIP-46 preauthorized bunkers and Blossom/NIP-96 upload
transport are implemented. Unsupported variants are listed in status.md.

## Ownership across tabs

Shared clients namespace sub/action/sign IDs internally. Each has its own wire
session; results and signer requests return only to the originating port.
Visibility is the union of visible wants across clients. Hiding one tab does
not close another tab's requests. Explicit close/hints release work.

Clients send heartbeat every 20 seconds. After 180 seconds without contact the
host releases that client's wants and sends reconnect. Explicit detach releases
immediately. The Transport adapter reconnects and reopens retained queries,
windows and hints. Pending actions fail offline rather than being replayed.

The dedicated fallback acquires an exclusive Web Lock before creating its
port-host Worker. BroadcastChannel forwards namespaced client messages. Browser
lock release elects the next leader after loss; no wall-clock lease is used.

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

Relay usage is supplied by the frontend through the separate relays message.
There are no implicit product bootstrap destinations.

## Persistence

Worker-safe IndexedDB uses `lkjstr-wasm`, schema 1: events have
`{id, created_at, raw}` with a created_at index. Raw holds a compact
tuple; previous JSON objects still read. kv holds private account state and values.
Writes resolve on transaction commit and retry from a bounded 20000-event
buffer in batches of 500, no more frequently than every 1.5 s.
Startup reads only the newest 2000 events and verifies them incrementally.
NIP-05 requires exact-key HTTP evidence, redirect rejection and a 64 KiB body
limit; metadata replacement invalidates verification. No secret keys appear
in rows, diagnostics or fixture output.

Successful live writes prune the oldest physical rows beyond 20000. Account
mutations commit before installing state. The cold-start browser benchmark
seeds 100000 signed physical rows; engine-performance.md reports its timings.

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
