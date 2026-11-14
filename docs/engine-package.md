# Engine package

## Purpose

Build the real Worker as static assets for the independently owned frontend.
There is no generated HTML, Trunk invocation, deployment or frontend source edit.

## Build

```sh
sh scripts/engine-package.sh
```

Requires the installed Rust/WASM toolchain and wasm-bindgen 0.2.122. Cargo and
wasm-bindgen caches default to ignored worktree directories. Override the binary
with LKJSTR_WASM_BINDGEN. All builds use four jobs. The command prints byte sizes.
The output directory is tmp/engine-dist; copy its contents to the frontend's
public/engine directory. File names and measured sizes are recorded below.

The module exports workerTransport(options): the same post/listen/close
Transport accepted by the frontend's createEngine. It also exports
createMockEngine(post): the mock's handle/dispose factory shape, backed by Rust.
The optional relay array is sent separately from EngineConfig. No relays are
silently selected by the engine.

## Three frontend lines

Replace the existing import, add the transport import, and replace creation:

```ts
import { createEngine } from './engine/client.ts';
const { workerTransport } = await import(/* @vite-ignore */ new URL('/engine/transport.js', location.href).href);
const engine = createEngine(workerTransport({ relays: [{ url: 'wss://nos.lol/', read: true, write: true, search: false }] }));
```

That relay is an explicit integration example, not a test destination. Pass the
frontend's chosen relay configuration instead. Apply protocol-additions.patch
to the frontend-owned protocol.ts. The computed module URL keeps these static
Worker assets outside the frontend bundler; the current ES2023 target supports
this import. No UI edits are included in this worktree.

The adapter handles NIP-07 public-key discovery, heartbeat and detach. Existing
client.ts continues handling event signing. SharedWorker is preferred. The
fallback uses one dedicated Worker under an exclusive Web Lock, with a
BroadcastChannel forwarding ports. Loss of the leader releases the lock;
followers reconnect and replay queries/windows/configuration. Pending actions
fail with offline and are never replayed. There is no wall-clock leader lease.

## Contract gate and benchmark

```sh
sh scripts/engine-check.sh
LKJSTR_COLD_START=1 sh scripts/engine-check.sh
```

The gate fetches the current frontend into an ignored standalone Git repository,
applies the additions to a temporary copy, and derives reply validators from
that TypeScript AST (pinned TypeScript 5.9.3). Patch conflicts, new untested mock
message/action kinds and invalid reply shapes fail the gate. The real WASM
Worker uses fresh IndexedDB, a loopback relay, intercepted media HTTP and an
in-process fixture signer. No public traffic is permitted.

The optional benchmark seeds 100000 physical signed compact rows. Timings are
reported, not thresholded. Reports live in tmp/engine-harness. See
engine-performance.md and status.md for measurements and unsupported variants.

## Artifact inventory

Product package (bytes), built without harness exports:

| File | Bytes |
| --- | --- |
| lkjstr_engine_bg.wasm | 3217564 |
| lkjstr_engine.js | 45402 |
| worker.js | 285 |
| shared.js | 225 |
| transport.js | 7309 |
| Total | 3270785 |

Fetched frontend contract: 3c236c89743dd5d76d11cfecfb17e380e2b962ad.
The package inventory is independent of the cold benchmark fixture file, which
is excluded from the output directory.
