# Engine package

## Purpose

Build the real Worker as static assets for the independently owned frontend.
There is no generated HTML, Trunk invocation, deployment or frontend source edit.

## Build and release

```sh
cd web
pnpm build:real
pnpm smoke:real
pnpm package
```

build:real runs scripts/engine-package.sh, then builds web/ with
--engine=../tmp/engine-dist. The Rust toolchain, wasm-bindgen 0.2.122,
Node 24 and pnpm 11 are required. The crate is lkjstr-engine-worker; its
generated asset basename remains lkjstr_engine. Set LKJSTR_WASM_BINDGEN or
put the matching CLI on PATH. Caches and build output stay in ignored
worktree paths; Cargo jobs and test workers are capped at four.

The package remains usable independently with sh scripts/engine-package.sh.
It writes transport.js, shared.js, worker.js, lkjstr_engine.js and its WASM
module to tmp/engine-dist. The frontend hashes the full dependency graph,
rewrites every import/Worker/WASM URL, and references the adapter and WASM
by absolute path in index.html. No mutable engine asset names are shipped.

Startup uses workerTransport from the package instead of the mock Worker.
The frontend selects saved relay settings for the cached account when present;
otherwise DEFAULT_RELAYS in web/src/engine/startup.ts is the single default.
Successful relay saves persist in frontend storage. A verified active-account
NIP-65 list replaces bootstrap read/write usage; bootstrap search usage remains.
Replaying another tab's bootstrap cannot override that learned owner list.

In web/, pnpm build and pnpm smoke build the mock. Root pnpm build builds the
real product. In web/, pnpm package packs the current
dist without rebuilding, so a real release cannot silently become a mock.
The archive is tmp/lkjstr-dist.tar.gz; validate it with the host's unmodified
release.py unpack function before handing it off. Nothing is deployed here.

The adapter handles NIP-07 public-key discovery, heartbeat and detach. Existing
client.ts continues handling event signing. SharedWorker is preferred. The
fallback uses one dedicated Worker under an exclusive Web Lock, with a
BroadcastChannel forwarding ports. Loss of the leader releases the lock;
followers reconnect and replay queries/windows/configuration. Pending actions
fail with offline and are never replayed. There is no wall-clock leader lease. Worker names, locks and channels are scoped
to the hashed adapter URL so an older engine graph can coexist during a release.

## Contract gate and benchmark

```sh
sh scripts/engine-check.sh
LKJSTR_COLD_START=1 sh scripts/engine-check.sh
```

The gate reads the authoritative contract and mock inventory from this merged
worktree and derives reply validators from its TypeScript AST (pinned
TypeScript 5.9.3). It performs no fetch or Git operation. New untested mock
message/action kinds and invalid reply shapes fail the gate. The real WASM
Worker uses fresh IndexedDB, a loopback relay, intercepted media HTTP and an
in-process fixture signer. No public traffic is permitted.

pnpm smoke:real exercises the actual TypeScript app with production headers
and a loopback-only connect-src override. External HTTP is blocked. It covers
home/global, note/profile navigation, search, composition through NIP-07,
publication/reaction, settings reload and two app tabs sharing one engine.
There is no account-add UI yet: only the fixture account setup uses a second
real adapter port; composition and reactions use the app's existing controls.
The report is tmp/smoke-real/report.json.

The optional benchmark seeds 100000 physical signed compact rows. Timings are
reported, not thresholded. Reports live in tmp/engine-harness. See
engine-performance.md and status.md for measurements and unsupported variants.

## Artifact inventory

The package command prints current byte sizes. Harness exports and fixture
files are excluded from product output; the frontend copies every required
engine dependency explicitly. The release has one WASM module, three hashed
engine JavaScript modules, the hashed adapter, and the unchanged UI assets.
