# Avatars and visible-author profiles

## Purpose

Avatar image ownership, derived storage and verified name hydration in the current implementation.

## Ownership

Visible-author names come from verified kind-0 metadata. Automatic hydration keeps the delivering/configured
relay requests and their 50 ms coalescing. A missing profile with a known usable NIP-65 write advertisement
also requests that author's write route. Existing twelve-route admission, read opt-outs and view lifetimes apply.
A read-only advertisement does not supply an author's profile. Already known names remain part of row projection.

The core owns avatar admission, scheduling, expiry, negative backoff and persistent LRU plans.
The Worker owns anonymous CORS fetch, body limits, bitmap derivation, encoding and IndexedDB transactions.
The page draws the result and owns only live face leases and object URLs. It does not fetch or retain originals
for the derived cache. Plain-image fallback remains the browser's ordinary image/HTTP-cache path.

## Finite channel

- `avatar.want {req,url}` requests one exact picture URL; profile IDs and name changes do not change its identity.
- `avatar.close {req}` releases that client's pending request. Hiding or detaching releases all its pending owners.
- `avatar` replies to the originating client with `ready`, `fallback`, `deferred` or `rejected`.
- Ready carries an actual structured-cloned Blob and edge, source dimensions, actual bytes and MIME metadata.
- `retained:false` can carry a usable ephemeral derivative when storage is unavailable.
- Fallback includes the known-uniform flag. Deferred includes a bounded retry delay; it does not bypass admission.
- Blobs are absent from rows, snapshots, JSON and transfer lists. Startup/reconnect replays at most 256 pending wants.

A shared Worker coalesces pending exact URLs across clients. Independent Worker graphs use the same atomic
database contract. Finished Blobs are not retained in an idle Worker memory pool.

## Drawing

Small, list and channel faces use one centred square still, at most 160 pixels, without enlarging small sources.
The existing circle dimensions and letter disc remain. A custom 72-pixel list face still uses this one size.
The 76-pixel profile-header role uses the original image in ordinary motion and the still path under reduced motion.

Successful derivation makes a still. Original-image fallbacks may animate in ordinary motion.
Accepted inline PNG, JPEG, WebP and SVG profile pictures keep that original route within the message-byte bound;
they create no Worker lookup, fetch, codec, storage job or negative entry. Other non-HTTPS inputs are rejected.
Under reduced motion, a non-uniform fallback is drawn once into a face-sized canvas without pixel readback,
encoding, storage or a second fetch. Failed images keep the letter disc. A known uniform still keeps that disc
under reduced motion without requesting the original image or drawing a canvas.

One owner on `host.app` covers views, the topbar and overlays. Detached render candidates acquire nothing.
Current viewport and ancestor scrollport geometry decide ownership; queued observer entries cannot override
newer geometry. Replacement nodes acquire before removed nodes release, preserving shared exact-URL work.
Hidden, offscreen and disposed faces release ownership. The final page owner revokes its object URL.
Page hide, back/forward-cache transitions and host disposal fence old callbacks and release or resume leases.
The page holds at most 256 exact URLs and 512 face owners, with no idle Blob pool.

## Worker limits

| Resource | Bound |
| --- | --- |
| Pending owners | 512 per client, 4096 per Worker host |
| Wanted URLs | 256 per client |
| Jobs, including retiring effects | 1024 |
| Lookup / raw payload / derived payload / store credits | 4 each |
| Fetches | 4 globally, 2 per normalized requested hostname |
| Decode and encode | 1 active operation |
| Original body | 2 MiB, checked while reading actual bytes |
| Derived image | At most 160 by 160 pixels and 128 KiB |
| Active time | 15 seconds across stages; queue time excluded |
| Lookup and store stage | At most 3 seconds |
| Fetch and derive stage | At most 10 seconds, within remaining active time |
| Memory-only negatives | 512; transient 30 seconds, unsupported 10 minutes |
| Storage write backoff | 60 seconds after unavailable storage |

Fetch uses omitted credentials, no referrer and normal redirects, requiring a successful readable final HTTPS
response. Opaque responses are not cached. The hostname cap concerns requested URLs, not redirect destinations.
Cancellation invalidates delivery immediately; an uncancellable bitmap operation keeps its permit until its
actual promise settles, when its bitmap is closed. A timed-out codec disables new derivation for that Worker host's
lifetime; cache hits can still succeed. The implementation has no pre-decode pixel-count bound.

The Worker centre-crops once with high smoothing. It requests WebP quality 0.8 and checks actual Blob MIME.
If unsupported, opaque images use JPEG and alpha-bearing images use PNG. Every RGBA channel ranging by at most
four marks a uniform still: it becomes an unsupported negative before encoding or storage, without frame seeking.

## Disposable storage

`lkjstr-avatar-v1` schema 1 has `meta`, `entries` and `blobs` stores, separate from protected
`lkjstr-wasm` schema 2. Hits touch the monotonic LRU sequence; insertion, victims and accounting commit in
one read/write transaction. Concurrent writers reuse an already committed exact URL and its actual Blob size.
The cache retains at most 20 MiB of Blob payloads and 4096 entries. These are not physical database or RSS limits.
There is no positive TTL or timed original-image revalidation. Eviction, invalid disposable state or storage loss
can cause a later fetch. Structural metadata, MIME and actual Blob-size checks reject invalid cache records.

## Verification scope

Native tests cover routing, stable batching, role/read opt-outs, actual-byte LRU plans, owner limits and cancellation.
Focused page and transport tests cover shared object URLs, stale replies, visibility, fallback and bounded replay.
Original-source and mutation controls prove the routing, LRU, queued-body and retiring-permit assertions can fail.
Production-Worker controls cover concurrent IDB writers, both cache caps, cancellation, real bitmap closure,
actual Blob delivery through both transports, page disposal and full-process cache reuse. A separate real quota
denial/restoration control observes usable ephemeral Blobs and write backoff. Failed fixture attempts remain recorded.
The controls do not establish indefinite leak freedom, physical database limits, or storage recovery after backoff expiry.

## Measured limits and follow-up

A fixed local 24 Mbps / 80 ms RTT corpus compared shipped be29d25f with candidate 9f9032df at 390px and DPR 3.
Matching visible cohorts are Home 6, Notifications 8 and Thread 7, with one selected run per view/state.
Both pins show names with every warm row (42/42 observations). Candidate cold navigation-to-first-name is
3690 ms, 3111 ms and 2423 ms respectively; the one-second cold target remains unmet.
Two Home avatars and one Thread avatar are unobserved at the fixed cold endpoint. Later completion does not
convert those censored measurements into successes.

The CORS-readable no-store Thread image needs no original GET after restart, versus one before.
The non-CORS no-store Home/Notifications image is fetched once on a same-process return and twice after restart
(failed CORS plus plain image), versus zero and one previously.
Whole-Home originals fall from 49 to 8 cold-initiated GETs and from 21 to 2 after restart as offscreen work is avoided.
These counts do not erase the visible fallback repeat cost. Server body sizes are not TLS bytes or client receipt.
No public-host CORS census was run; the assumed mix cannot establish population coverage or general latency savings.

The engine resource-instrumentation owner retains the cold-path follow-up: measure navigation-to-row/name separately
from row-to-name and preserve missing outcomes. This Home engine is ready at 1573 ms; shell install also fetches
the WASM already loaded by the Worker. Cache hits and byte reductions therefore do not establish earlier visible
content. Separate startup, hydration, derived-cache lookup, failed CORS, original fallback and reacquisition costs
in the resource-decision evidence before changing policy.
