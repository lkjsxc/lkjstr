# Compact event store

## Purpose

Reduce the managed memory needed by verified public events without changing Nostr
serialization, verification, query order or deletion authority.

## Resident representation

`store/compact/` owns immutable event payloads. IDs and public keys are exact 32-byte
values, signatures are 64 bytes, content is an owned byte string, and tags use flat
fields plus explicit boundaries. Dictionaries share public keys, tag strings and
observed relay URLs. Empty tags, duplicate fields, unknown extensions, Unicode and
case-sensitive arbitrary values round-trip exactly. Content is not interned.
Events with no tags need no tag-array allocation. Dictionary text hits borrow the
lookup text before allocating, including repeated relay observations.

Direct reference-counted handles cannot resolve a later reused slot. Main event,
author, reference, replacement, generation and access indexes use binary identities.
Ordered indexes hold shared payload handles and compare actual timestamps and IDs,
so same-second feed order and the opposite NIP-01 replacement tie rule are preserved.

The protocol boundary remains `NostrEvent`. Queries filter compact headers/content
before materializing selected results. The store retains no permanent decoded copy.
The duplicate fast path compares every signed field, including the signature; an ID
match alone never bypasses ordinary verification. Receipt bytes and signature rules
remain unchanged. Fixed-size header fields are decoded once before index mutation
and reused during packing. Cache membership checks borrow leases, and reference indexes
borrow binary tag identities without converting through hexadecimal text.
The canonical protocol hex writer reserves once and writes lowercase digits directly;
receipt formatting and compact projections share it instead of formatting each byte.
Release builds optimize the existing SHA-256 package for speed after production CPU
profiling identified receipt hashing as a startup cost. Algorithm and features stay fixed.

## Persistence ownership

Verified ingress and the event indexes share one compact payload with the retry queue.
A 500-event transaction batch clones handles, not bodies. Evicted payloads remain alive
and charged until outstanding leases are released. Cache rows are encoded at the Worker
transaction boundary; failures leave the pending leases available for retry.

The queue is bounded by 20000 entries and 64 MiB of conservatively attributed payload.
Verification pauses before consuming more ingress when capacity is unavailable. A
new optional row cannot silently discard an older policy/deletion witness. Staged own
notes reserve capacity before publication but enter a persistence batch only after a
frame is transmitted. Terminal unsent publications release their reservation.

Dictionary-only symbols remain charged until a sweep reclaims them. Pressure sweeps
are unconditional. Periodic maintenance checks the release epoch every 256 packs,
so append-only hydration skips full dictionary scans. Shared symbols outlive their pool when a payload lease
still references them. Final destruction returns the fixture allocation delta to zero.

## Accounting and retention

The managed budget covers payload Box/Arc allocations, dictionary buckets, index
capacity, parsed profiles, relay observations, access/generation state, bounded loss
and deletion evidence, and pending lease overhead. Unused capacity stays charged.
Relay-vector capacity is maintained at allocation and removal, so budget checks do
not rescan every relay vector. Independent census tests cover growth and removal.
Standard-library hash/tree node layouts are opaque: those structures receive a
conservative capacity reservation, including a possible retained empty tree root.

This is an application allocation ledger, not browser RSS or total WASM linear memory.
Temporary protocol projections, verification/network buffers and the Worker's encoded
transaction rows and boot replay buffers have separate lifetimes outside this ledger.
The diagnostics distinguish managed cache allocation from the wire payload counter.

GDSF uses attributed resident body/index cost in its denominator. Wire payload size
continues to determine network recovery cost. Fixed deletion/loss evidence is charged
to the total budget, without pretending that evicting an unrelated event frees it.
Protected account policies, held rows and required evidence remain above utility.

The count caps remain 16000 regular and 4000 replaceable events. The managed allocation
target remains 64 MiB. Required evidence and pending persistence can prevent immediate
reclamation; their bytes are never reported as freed before their references disappear.
Count pressure uses one accounting pass after the batch. True byte pressure rechecks
allocation after each actual victim and symbol sweep. Incremental pressure epochs are
still a subsequent performance slice.

## Frozen native qualification

The fixture contains 12000 events: 128 profiles, 128 follow lists and 11744 notes,
128 authors, 160-byte note content, repeated references/tags, sparse Unicode/empty
extensions and two relay observations per event. Synthetic signatures have valid
shape; this witness measures post-verification storage, not cryptographic throughput.

| Requested live allocation | Before | Compact |
| --- | ---: | ---: |
| Resident bytes | 26660358 | 10614807 |
| Bytes per retained event | 2221.6965 | 884.5673 |
| Events per MiB | 471.9709 | 1185.4113 |
| Store plus pending queue | 40006820 | 10745911 |
| Additional 500-event batch | 1116492 | 4000 |
| After full destruction | 0 | 0 |

The measured allocation density gain is 2.5116x; resident allocation falls 60.185%.
These are native requested allocation bytes on one matched fixture, not a raised
count limit or a browser heap measurement. The conservative managed ledger exceeds
the independent allocator measurement. The private handoff records final accounting,
real-Worker warm-cache DOM/rAF readiness measurements, fixture paths and quiet gates.

## Warm-cache browser qualification

The production Worker passes 120/120 cases on a frozen signed fixture: 30 alternating
pairs per Home source against fixes-only, fresh contexts, committed IndexedDB and
800 ms relay profile delay. All four gates pass: paired median <=0 ms and p95 change
<=2 ms. Names are present before a relay profile copy in every case.

| Source | First-note paired change ms | Eight named rows ms | First-note p95 change ms | Eight-row p95 change ms |
| --- | ---: | ---: | ---: | ---: |
| Home | -16.80 | -16.60 | -47.40 | -43.40 |
| Their Home | -14.20 | -14.60 | -12.50 | -13.10 |

All four paired bootstrap 95% intervals are below zero. These are pre-paint DOM/rAF
observations on this desktop fixture, not compositor timestamps or a device matrix.
The combined storage and receipt-performance changes are measured together. Prior
failed cohorts, exact artifacts and confidence intervals remain in the private handoff.

## Remaining slices

1. Unify durable GDSF with resident retention, bounded pressure epochs and required
   evidence recovery. The current 20000-row disk pruning policy remains in place
   until that coordinator is qualified.
2. Introduce raw persistent columnar pages, a directory, integrity receipts and
   resumable migration. Qualify cold compression with raw fallback separately;
   preserve account/private/outbox and receipt/context transaction boundaries.
3. Add a small local predictor in shadow mode, validate it against the heuristic and
   shuffled controls, then qualify local prefetch and bounded reuse weights separately.
