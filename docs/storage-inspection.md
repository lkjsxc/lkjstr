# Storage inspection

## Purpose

Protocol 12 adds finite, read-only storage observations for a future surface.
Focused native, client and production Worker checks and all merged gates pass.
This does not clear data, export settings or reinterpret Stats.

## Contract and scope

`storage.inspect {req}` returns `storage {req,report}` to its attached owner.
`storage.close {req}` cancels only that owner's request. The client facade is
`engine.storage.inspect({signal?})`; it requires an advertised protocol 12.
Admission failures use the existing failed `result` and its stable error code.
There is no new control, visible word, layout or automatic inspection.

`report.memory` contains `events`, `eventPayloadBytes` and `at`. It observes the
retained core event store, including encrypted relay payloads, at admission.
Payload bytes sum the UTF-8 strings in
IDs, public keys, signatures, content and tags. They exclude JSON framing,
numeric fields, allocation overhead and physical storage. Existing
`Stats.totals.cacheBytes` keeps precisely that previous payload meaning.

`report.persistedEvents` is a tagged union. A ready result has an exact `count`
from a successful readonly transaction over all records in the `events` object
store. This includes cached encrypted DM/list payloads; counting neither reads
nor validates bodies, so invalid persisted records also count. Decrypted
messages, keys and private archives are separate state and are not traversed.
`at` records the completion callback. Live writes may continue before
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

## Focused and merged verification

The original isolated preflight passed `pnpm --dir web check` on 2026-11-16
at 19:47:00 UTC in 7.177 seconds, load 2.32 / 1.52 / 1.20. It includes
TypeScript, Biome and the nine client/mock cases. Two transport/contract cases
passed at 19:49:07 UTC in 0.214 seconds. Initial missing links, formatting and
an invalid watchdog failure code were corrected; the watchdog uses `offline`.
Those original logs remain in storage-inspection-tree's tmp/storage-preflight.

The device integration compiled source `6ba4b526` with four build jobs/test
threads and refreshed/hash-recorded Rust sources before each Cargo stage:

- Fourteen native policy/wire cases passed at 20:13:36 UTC in 9.999 seconds,
  load 1.08 / 1.59 / 2.11. They cover outcomes, safe numbers/times, caps,
  duplicate admission, deadline ties, owner isolation and revoked generations.
- Focused native Clippy and Worker wasm32 check/strict Clippy passed, taking
  4.005 / 4.408 / 4.545 seconds respectively.
- Production WASM and its export guard passed at 20:14:01 UTC in 24.672 seconds,
  load 1.45 / 1.64 / 2.11. The frozen package is
  `tmp/device-artifacts/af100217510e010cad3f/tmp/engine-pkg`.
- The integrated nine client and two transport cases passed at 20:15:02 UTC
  in 0.791 / 0.233 seconds, load 1.80 / 1.74 / 2.11.

The production WASM SHA-256 is:

```text
9088e280584f9c35372b96b6fbd2a07b4ee6e14b3c276b4f45f5f44b0ebe6aef
```

The first two finite Worker attempts reached all 18 assertions but failed
whole-Host read attribution: normal DM marks loading begins after ready and
overlapped the inspection trace. A test-only completion witness now waits for
that known startup transaction before resetting the trace. The original exact
one events-store count/no KV-or-body-read assertion is unchanged. Product Rust/WASM did
not change. The bounded diagnostic retains store/method/role, never key values
or stored bodies. Both failed attempts remain under tmp/storage-focused-try1/2.

The corrected fixture passed 19/19 checks on the same production bytes at
20:18:03 UTC in 0.763 seconds, load 4.28 / 2.45 / 2.29. Its two MessagePorts
and two fresh contexts cover exact stored row count versus empty hydrated
memory, unchanged Stats, independent failures, cancellation/reused requests,
hide/detach/stop, missing IndexedDB and the startup measurement boundary.
The estimator, deadline and callback order are controlled test effects; this
is not a measurement of actual disk usage or wall-clock deadline precision.

The final report is `tmp/storage-focused-try3/report.json`; all stage logs,
source maps and cleanup results are in tmp/device-gates.json and adjacent
files. No owned descendant or short temporary alias remained. The fixture
opens no account or external socket and is registered in engine-check.sh.
All required merged gates and fresh production/helper proofs pass; exact
source, timings and artifacts are in [engine-device-verification.md](engine-device-verification.md).
A reachable interface and deployment remain pending. No test-control export was introduced.

The initial merged gate was deliberately stopped on 2026-11-16 at 20:29 UTC
to correct public-only wording in comments and this contract. The actual DM
wants, delivery, store and persistence paths retain encrypted kinds 4/1059 in
this same store; private plaintext remains separate. No runtime calculation or
assertion changed. The interrupted process ledger retains exit 130 and empty
owned cleanup; it is not a product-failure reproduction.

## Separately planned work

A selective event-cache clear and a narrowly allowlisted settings archive are
proposals in [storage-next.md](storage-next.md). Neither is implemented. The
events store also retains encrypted message history, so an indiscriminate clear
would not preserve offline messages. Inspection reads no keys, credentials,
private marks/drafts, pending-publication state, localStorage or shell contents.
