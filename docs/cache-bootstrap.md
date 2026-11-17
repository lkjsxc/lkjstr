# Cache bootstrap

## Purpose

Restore previously verified public data before opening Worker views, including
author names and follow lists older than the newest-event startup slice.
This is the first cache improvement. It does not claim the whole cache rule or
the pre-engine first-paint target.

## Current implementation

The events object store keeps compact public event bytes plus an optional
verification receipt tagged with its format. The receipt is a SHA-256 digest of the exact
encoded bytes with a format prefix. Restoring a trusted row also checks
its indexed id, timestamp and kind against the decoded event.

Only the already verified ingest and validated signer completion paths enqueue
these writes. A matching receipt avoids a second signature check on reload.
Older rows, changed bytes, unknown receipts and inconsistent row headers use
the existing bounded verification queue. Valid older rows enter the normal
persistence queue and receive receipts after their transaction commits.
Malformed rows do not establish complete cached history. Embedded repost
targets still need their separate existing verification.

A receipt detects changed bytes and identifies the writer's verification
contract. It is not authentication against arbitrary same-origin code, which
can already replace the application's storage or execution.

The existing kv store contains `verified-public-metadata-v1`: replaceable public
events and signed deletion fences. Each write merges the current committed
checkpoint and the incoming records inside the same events+kv readwrite
transaction. Replaceable ordering matches Store: newer timestamp, then lower
id. A stale Worker cannot overwrite newer author/kind metadata. Deletion fences
apply only to targets signed by the deleting author; an unrelated author's
deletion has no authority. The retained fences also prevent stale writers from
reviving a deleted profile after its deletion leaves newest-event replay.

The checkpoint stores bodies, not event-store references. A schema-2 rollback
Worker can still timestamp-prune ordinary event rows without deleting this
checkpoint. No account key, account revision or database schema changes.

Boot reads this checkpoint before the newest 2000 event records. It restores
checked metadata and deletion fences before replaying queued view opens, so
the first Home query has the held follow list and author information. Missing
or failed public cache reads retain the existing error/state behavior; account
reads retain their strict failure boundary.

## Bounds and remaining work

The checkpoint holds at most 4000 records and 4 MiB of serialized UTF-8 bytes,
including its envelope and separators. These are additional cached copies,
not a claim about exact browser disk allocation. The most recently written
records are retained; old event timestamps do not make a just-seen profile
lose to bulk notes. Evicted deletion fences no longer establish deletion
history, matching the existing bounded tombstone limitation.

The ordinary event store still prunes to 20000 by event timestamp, and the
memory store still uses 16000 regular plus 4000 replaceable records with a
64 MiB payload bound. Last-seen eviction, protected own events/followed profiles/
bookmarks, exact disk payload budgets and durable per-filter relay checkpoints
are separate work. This change does not reduce second-visit relay requests by
itself. Protected data will require an explicit budget floor; an unknown
private bookmark set cannot be guessed or exposed in a public retention map.

The public checkpoint contains signed public events only. Encrypted list
content remains ciphertext. Decrypted private entries, message bodies, keys
and draft plaintext never enter it.

## Verification

Native regression sources cover exact-receipt restore before ticks, older-row
upgrade, altered bytes, header/format mismatches, incomplete history, old
profile restoration, stale metadata writers, replaceable ties, count/byte
bounds and deletion ownership with a late stale writer.

The separate scripts/engine-cache-bootstrap.mjs browser proof requires an
explicit production package, its exact WASM and loader SHA-256 hashes, and an
already built engine-fixtures signer. It uses a fresh browser context and
loopback relay with signed public data. It first proves live receipt and
persistence, then inserts 2100 newer fixture notes and reopens offline. The
old follow list, name, picture URL and Home row must remain available within
100 ms of view open. Altering stored note bytes without updating the receipt
must never paint that event. This measures Worker row projection, not DOM
paint or decoded image readiness. A second fresh context aborts one Worker's
actual metadata transaction, verifies both stores rolled back, lets another
Worker commit newer metadata, then releases the older retry and checks that
the current checkpoint survives. Release exports and WASM are unchanged;
the fixture controls only the browser's transaction/network boundary.

Required environment: LKJSTR_CACHE_PACKAGE, LKJSTR_CACHE_WASM_SHA256,
LKJSTR_CACHE_LOADER_SHA256 and LKJSTR_CACHE_FIXTURES. Set LKJSTR_ENGINE_REPORT to
an owned output directory, then run node scripts/engine-cache-bootstrap.mjs.
The report records artifact hashes, timing, load, blocked external traffic,
publications, errors and cleanup. Run the same script against the frozen
baseline and candidate packages, one browser harness at a time.

On 2026-11-17, all 13 focused native cases and strict native/WASM Clippy pass.
The release package passes the production export guard. Native tests finished
at 00:27:19 UTC in 19.3 seconds; load was 1.82/5.42/7.57 at their start.
The final package completed at 00:28:36 UTC. JavaScript syntax, rustfmt, diff
checks, changed-document shape and source bounds pass. The initial Clippy
style/test-allowance findings and a missing local bindgen path were corrected
before the final pass; no runtime regression failed.

The frozen package is tmp/cache-proof-package-7e179251. Its WASM is 8375196
bytes, SHA-256 201cd7b26051cb9d69f2249e6c114311aff825949a79d9a5e1b5392026f2540f.
The loader is 47332 bytes, SHA-256
e798a1069485a405fb66e5a622b18ab56b6081a53130dd1f4f00c6e56a751f01.
Its adjacent manifest binds the unchanged build/test source. Date, load,
commands and log hashes are in tmp/cache-validation.json. The shared target
was 5.4 GiB after this work; builds used four jobs and no debug/incremental data.

The browser proof and combined release gates have not run for this change.
No measured browser cache gain or deployment is claimed yet.
