# Durable GDSF and proof recovery

## Purpose

Keep resident and IndexedDB retention under the same integer GDSF policy, while
preserving verified revision and deletion authority through pressure and retries.

## One policy, two resources

Both adapters use the shared score, exact score/ID tie order and 95% pressure targets.
Resident costs describe attributed compact allocations. Durable costs count UTF-8
record fields and a 256-byte reservation for the row's hints and key/time indexes.
The durable ceiling is 20000 total event rows and 64 MiB of application charges.
This is not the browser's physical storage estimate. Resident ceilings stay
16000 regular, 4000 replaceable and 64 MiB of managed cache allocation.

Access weights, observed recovery costs, account policies, held windows and read
dependencies come from the same engine observations. Each resource has its own
inflation clock. Equal inputs/costs have equal victims; different representations
can legitimately produce different scores. No timestamp pruning remains.

Verified same-author deletions and NIP-01 revision order precede utility and holds.
Checkpoint references are hard dependencies until transactionally rewritten.
A deletion targeting another deletion has no effect, as specified by
[NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md#deletion-request-of-a-deletion-request).
Only current own policies are protected. Old own revisions cannot create an
unreclaimable floor. Required unknown-target deletion witnesses stay protected
even when the bounded resident tombstone indexes fill. Address witnesses also
remain effective after the cutoff index fills.

## Bounded epochs

Resident epochs freeze scoring time, access stamps, weights and payload generation.
They scan at most 256 headers and inspect at most 256 removal candidates per call,
rechecking current pins and generations before removal. Proof/graph snapshots stay
bounded by the existing store. Optional verification pauses under pressure; one
signature-checked deletion control can cross a 256-entry rotating ingress scan.

Epoch scratch has a separate 24 MiB retained reservation, checked at scan boundaries,
plus one scan slice of temporary headroom. Diagnostics expose pressureScratchBytes.
It is not included in managedCacheBytes. The frozen snapshots are released when
the epoch ends. This does not claim a bound on total browser/WASM memory.

The durable adapter scans at most 32 rows or 4 MiB per asynchronous cursor page.
An individually larger supported record occupies its own page. Header state is
bounded by the captured physical row count; growing concurrent snapshots restart.
Older caches above the normal count ceiling can therefore be reclaimed. Payload
pages are released after scoring; no whole-store decoded body snapshot is retained.
Current follow/mute weights are evaluated once for captured authors, then score
headers are reordered in bounded slices. Unknown access hints do not override mute zero.
Victim batches contain at most 256 rows. The committed epoch keeps its frozen time,
inflation base and target; a restart rescans headers and resumes committed progress.

All public writers, including old-schema migration and required-body reinstatement,
advance the same durable generation. The final events/kv transaction compares that
generation and rechecks live holds before deleting rows and advancing inflation.
An abort leaves rows, progress and inflation unchanged. A changed writer invalidates
the planned selection. Admission pauses between pressure batches; fixed pending
leases keep uncommitted bodies alive. A true protected floor remains backpressure.

## Required evidence references

The ordinary metadata checkpoint remains at most 4000 inline rows and 4 MiB. If
required evidence alone exceeds that representation, checkpoint format 2 stores exact
event-ID/receipt references to existing event bodies. The combined checkpoint has
at most 20000 inline/reference entries. Required event charges cannot exceed the
64 MiB durable budget. References do not create a second unbounded body store.

A writer resolves previous references in its events/kv transaction, checks exact
receipts and verified bodies, and merges replacements/deletions before selection.
Every newly referenced body is installed transactionally, including old inline
bodies already absent from the event store. Reinstatement contributes conservative
dirty-byte debt until the next scan reconciles actual rows.

Startup captures bodies before reading authority, then restores authority first.
This prevents a concurrent writer from introducing a body newer than the proof snapshot.
Startup retains the one-parse inline fast path. Empty deletion indexes avoid
allocating lookup keys, and receipt checks compare the exact lowercase digest
without allocating an expected receipt string. Neither changes signed authority.
Its 2000-row newest-first read uses
bounded reverse getAll options where supported; unsupported option dictionaries or
malformed raw rows use the existing valid-row cursor path. Both preserve timestamp
and primary-key order, and authority is still read after capturing bodies.
Clean maintenance skips its metadata snapshot. Durable utility observations for
actual writes follow the existing IDB awaits; pressure observations follow the
asynchronous pressure-needed check. Normal write/context metadata observations
remain synchronous. Referenced checkpoints are reread
and resolved in one serialized transaction, in groups of at most 32 outstanding
requests. Missing, mismatched or incomplete required evidence prevents startup
body/context restoration. No missing proof becomes an empty successful checkpoint.
Compact sufficient witnesses automatically collapse references back to inline form.

The retry queue retains its 20000-entry/64-MiB ordinary bound and has an explicit
32-deletion/4-MiB control reserve. During recovery it examines at most 256 leases
and tries the next deletion control fairly, so a reducing witness behind the first
500 FIFO entries can release the floor without unrelated proofs blocking its batch.
Failed writes acknowledge no leases. Successful retries and supersession release
their old payloads normally.

Schema 3 fences older checkpoint writers without changing account rows or revisions.
An older live connection blocks upgrade until it closes; pending editor state is
not forcibly discarded.

## Qualification

Native controls cover authored victim order and ties, resident/durable adapter
parity, resumed epochs, newly acquired holds, own-policy revisions, address cutoffs,
proof references and collapse, malformed references, foreign deletion authority,
tombstone saturation and control recovery behind blocked ordinary traffic.
Production Worker qualification on 2026-11-26 passed 20 actual IndexedDB checks.
Injected event/checkpoint and victim/state aborts preserved exact committed rows
and state. Retries committed without relay redelivery. There were no external
requests, publications, page errors or uncaught Worker exceptions.

A 3636022-byte inline checkpoint held 60 signed proofs absent from the event store.
Seventy-two proofs required 4361952 inline bytes. Recovery installed all 60 missing
bodies atomically and used a 12568-byte checkpoint with 74 references, including
two account dependencies. A sufficient signed witness collapsed it to 7391 bytes,
three inline rows and no references. Offline reads preserved deletion authority;
missing required evidence failed closed, including after a no-op deletion of a proof.

Durable pressure started at 20285 rows. After an aborted 256-victim transaction,
committed batches removed 256, 256, 256, 256, 256 and 5 rows. A real Worker restart
at 19773 rows retained the original 19000-row target and completed it. The old hot
control survived and the newer cold control was removed. Schema upgrade preserved
account bytes and revisions; an absent revision in schema 2 failed closed.

Nine production Worker startup-reader cases passed 52 assertions. Reverse batch
and cursor paths returned identical ordered records at the 2000-row boundary,
including timestamp ties and malformed rows requiring a later physical row.
Unsupported options used the cursor; an asynchronous abort remained a failure.
Short and empty stores also matched. Body capture still preceded authority reads.

Warm IndexedDB reload against retained b181f606 passed all 120 correctness cases
and all four timing gates in 30 alternating pairs per view. Deltas are candidate
minus reference; the gates remain paired median <= 0 ms and arm p95 delta <= 2 ms.
Intervals use 20000 paired bootstrap samples. The observations are DOM/rAF readiness
proxies, not compositor-confirmed pixel paint. All eight named rows were fully
visible before any delayed profile relay delivery.

| View | DOM/rAF metric | Paired median delta ms | Bootstrap 95% CI ms | p95 delta ms |
| --- | --- | ---: | --- | ---: |
| Home | First note | -2.90 | [-10.40, +0.90] | -20.80 |
| Home | Eight named rows | -2.90 | [-10.25, +0.95] | -20.40 |
| Their Home | First note | -3.00 | [-11.30, -0.80] | +0.80 |
| Their Home | Eight named rows | -3.10 | [-11.45, -0.80] | +0.20 |

Three earlier candidate cohorts failed and remain in the private evidence. Startup
changes remove unnecessary clean-maintenance observations, batch newest-body reads,
and avoid empty-evidence lookup and expected-receipt allocations. Fixtures,
measurement helpers, baseline and thresholds remained frozen throughout.

Exact fault/reload artifacts and quiet-gate logs accompany the private handoff.
These production controls are distinct from native post-verification fixtures.

## Project lesson

Owner: engine/cache maintainer. Retrying a protected floor needs access to evidence
that can reduce it. A FIFO retry and an admission pause can otherwise prevent their
own recovery. Preserve signed authority, budget the control lane, and recheck live
pins inside the final transaction callback.
