# Storage inspection

## Purpose

Protocol 12 adds finite, read-only storage observations for a future surface.
Client and mock checks have passed; native and browser effects remain untested.
This candidate does not clear data, export settings or reinterpret Stats fields.

## Contract and scope

`storage.inspect {req}` returns `storage {req,report}` to its attached owner.
`storage.close {req}` cancels only that owner's request. The client facade is
`engine.storage.inspect({signal?})`; it requires an advertised protocol 12.
Admission failures use the existing failed `result` and its stable error code.
There is no new control, visible word, layout or automatic inspection.

`report.memory` contains `events`, `eventPayloadBytes` and `at`. It observes the
retained core event store at admission. Payload bytes sum the UTF-8 strings in
IDs, public keys, signatures, content and tags. They exclude JSON framing,
numeric fields, allocation overhead and physical storage. Existing
`Stats.totals.cacheBytes` keeps precisely that previous payload meaning.

`report.persistedEvents` is a tagged union. A ready result has an exact `count`
from a successful readonly transaction over only the public `events` object
store. `at` records the completion callback. Live writes may continue before
or after that transaction; this count and memory need not agree. An absent API
is unsupported, an actual transaction/open failure is failed, and unfinished
work at the deadline is timeout. Those outcomes contain no guessed count.

`report.origin` independently reports ready, unsupported, failed or timeout.
Ready includes `usage`, `quota`, `at` and `approximate:true`. The values are
what `navigator.storage.estimate()` returned across the origin, including
other storage. They are neither exact physical disk bytes nor event-cache-only
bytes. Missing, fractional, negative, non-finite or unsafe values are failed,
never replaced by zero. A real returned zero remains valid.

All five time fields use floored `performance.now()` milliseconds since this
Worker's performance time origin. They are not UTC and are not comparable
across Worker lifetimes. Browser component times are callback observations,
not a simultaneous snapshot. The general Host clock uses wall time; this new
operation intentionally has no wall-clock fallback. If monotonic timing is
unavailable, it fails unsupported without inventing report times.

The [Storage Standard estimate algorithm](https://storage.spec.whatwg.org/#storage-estimate)
defines approximate origin usage; it does not expose exact per-store disk size.
The [IndexedDB transaction model](https://w3c.github.io/IndexedDB/#transaction-lifetime)
provides the bounded count transaction, not physical byte accounting.

## Bounds and lifetime

The core allows one request per attached client, four in total. Request IDs
are nonempty and at most 256 UTF-8 bytes. A repeated pending owner/ID is ignored;
a different request beyond either cap fails too-large. Internal generations
use checked increments and are not reused after close, detach or clearing the
book. Admission captures memory once and sets one absolute 15000 ms deadline.
Completing one component cannot extend the other component's budget.

Count and origin results settle independently. If an estimate is rejected,
a valid row count remains available. If the database is unavailable, an origin
estimate can still be ready. The Worker waits for its existing database open
within the original inspection deadline; it does not traverse boot accounts,
private archives or keys for inspection. The count reads no event bodies.

Close, page hiding, detach, expiry and permanent stop revoke exact leases.
Readonly transactions abort and handlers release on cancellation or deadline.
Only a current lease can produce a report. Callbacks capture weak Host
references, and stop closes the sink before revocation. A pre-boot detached
client cannot re-admit work while ordinary startup is still waiting. Replaying
ordinary startup hints does not reapply their old visibility to a newer read.

StorageManager has no abort interface. At most one unresolved estimate promise
exists per Host; its immutable lease vector never adopts a later request.
Cancellation suppresses delivery. If that browser promise never settles,
subsequent origin components wait within their own budgets and become timeout;
new count observations remain independent. Restarting the Worker releases this
unresolved browser-call state. No estimate response is persisted or logged.

The facade holds one promise and uses a 16000 ms delivery watchdog around the
Worker's 15000 ms policy. Missing delivery is a failure, not a synthetic report.
Abort, hiding, disposal or reconnect closes its request. Reconnect never
replays an observation into a different monotonic clock domain. The mock has
no signed-event store and reports zero retained events, with unsupported
physical/origin observations instead of fabricated disk evidence.

## Verification status and authored cases

The 2026-11-16 Node preflight passed at 19:47:00 UTC in 7.177 seconds, with
load 2.32 / 1.52 / 1.20. `pnpm --dir web check` includes TypeScript, Biome and
Vitest; the nine client/mock inspection cases passed in that gate. Changed
Rust files were formatted individually. The already-compiled xtask passed
`check-docs` and `check-lines`; no Cargo invocation was used.

The first preflight caught missing documentation links, formatting and an
unknown client failure code. The watchdog now uses existing `offline` instead
of the invalid code. Initial failures and final results remain in
`tmp/storage-preflight/{initial,after}.json` and their adjacent logs.

The two pure Node transport/contract cases also passed at 19:49:07 UTC in
0.214 seconds, load 2.21 / 1.80 / 1.35. The exact command was
`node --test scripts/engine-transport-storage.test.mjs`; evidence is
`tmp/storage-preflight/transport-contract-1.{json,log}`.

No native/WASM compile, native test, real Worker fixture or build has run for
this candidate. The following coverage boundaries remain explicit:

- Fourteen authored, unrun native policy/wire cases cover outcomes, numeric/time
  validation, caps, duplicate admission, deadline ties, owner isolation,
  cancellation/reuse, hidden/detached/cleared leases and additive messages.
- Nine passing client/mock cases cover capability, ownership, cancellation,
  late/reconnected replies, failure delivery and no invented physical size.
- Two passing transport/contract cases cover no replay, old connections and
  the literal true marker, including rejection of a false marker.
- The unrun `scripts/engine-storage.mjs` uses two ports, fresh contexts and
  three synthetic invalid public cache rows. It checks exact physical count
  versus empty hydrated memory, unchanged Stats, no private reads, independent
  browser failures, deadline/late callback order, hidden/detached/stop cleanup
  and missing IndexedDB. Its browser estimator and clock are controlled test
  effects; it does not measure the host's actual disk usage or real latency.

The finite fixture is registered in `engine-check.sh`, uses no accounts or
external sockets, records package hash/UTC/load and cleans browser/server on
failure. Native and real Worker execution evidence is still required before
landing. No production test-control export was introduced.

## Separately planned work

A generation-fenced public-event clear and a narrowly allowlisted settings
archive are proposals in [storage-next.md](storage-next.md). Neither operation
is implemented here. Keys, remote credentials, private marks/drafts, pending
publications, localStorage and offline shell caches remain outside inspection.
