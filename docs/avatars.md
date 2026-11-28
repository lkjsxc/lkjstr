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
for the derived cache. Plain-image fallback remains the browser's ordinary image/HTTP-cache path, with the live six-slot native lane
and eight-second attempt deadline. Visible faces release queued and active work on detach, hide or replacement.
An original-only editor preview does not acquire a derived lease or publish a copy offer.

The previous service-worker CacheStorage cache (64 originals, 128 KiB each, one-hour TTL) and the derived
IndexedDB database share a historical name but are different storage APIs. On an IDB miss the Worker can read a
fresh previous original by exact URL (no query or fragment), with bounded lookup/body time and size checks; it
does not create or write that cache. If missing or expired, the Worker does one anonymous CORS fetch. The new
page's eligible verified-note fallback may read the existing SW original via its marker but never offers a
second copy. Previous clients retain their bounded copy path until they update. A successful derived face uses
only the delivered Blob and never loads the original through the SW. Uniform/unsupported or non-CORS fallback
can still need a native original request after the CORS attempt; an ordinary large header intentionally needs
the original. Neither requests a redundant background SW copy in the new page.

## Finite channel

- `avatar.want {req,url,rank?}` requests one exact picture URL; profile IDs and name changes do not change its identity.
  `rank` (0 or absent, 1, 2) orders queued work only. A job runs at the best rank any of its owners asked from.
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
The rule (owner, 2026-11-28): a row never shows the letter for a person whose picture this session already drew.
Every mounted face therefore holds its lease and its image for as long as it is mounted, wherever it is scrolled.
Position only orders the asking, and the Worker schedules by it: rank 0 on screen, rank 1 within one screen of it
(at least 192 CSS pixels), rank 2 the remaining mounted rows of the feed window. Geometry is read once per
animation frame on scroll and resize, and in a microtask before paint when faces mount; a scroll frame touches
only faces whose rank changed. A pending face that comes on screen asks again at rank 0 and then closes its
older request, so the shared job keeps running and moves to the front.

The page keeps a session picture cache: every settled exact URL, owned or not, at most 1024 URLs and 32 MiB of
ready Blobs (each at most 128 KiB). Each ready entry holds one decoded image, which keeps the picture in the
document's available images: a new or returning row for that URL gets a complete image synchronously, in the
microtask after it mounts, without a Worker round trip. Only unowned entries are evicted, least recently released
first. Unowned fallback and refusal answers are asked again after two minutes. At most 256 URLs wait unsettled,
the Worker's bound for one client; further faces wait for room and never start an original as a bypass.

Hiding the tab, hiding the document and entering the back/forward cache keep every face, image and cached URL.
A hidden page only stops asking: its pending requests close and are asked again, with new request ids, on return.
Authoritative account removal still revokes every URL and asks afresh; request generations reject old replies.
Data saver asks only for ranks 0 and 1 and keeps whatever it has already drawn.

Unchanged row faces retain their decoded image or canvas through one-to-one matching by author and public/preview
role. Ready derivatives use synchronous decoding hints; static faces keep their lease when reduced motion changes.
Original-image fallbacks start only at ranks 0 and 1, and a queued original loses its slot when it moves further
away; a loaded one stays in its row. The page holds the last 128 loaded originals the same way as stills, so the
same picture in another row is complete at once. Freezing reuses the existing source, and unfreezing holds the
canvas until the replacement loads. Native concurrency/deadlines and task-delayed frozen-source release remain.
Reuse never promotes the entry's original public-provenance bit; Worker storage and codec limits are unchanged.

## Worker limits

| Resource | Bound |
| --- | --- |
| Pending owners | 512 per client, 4096 per Worker host |
| Wanted URLs | 256 per client |
| Jobs, including retiring effects | 1024 |
| Lookup / derived payload / store credits | 4 each |
| Raw payload credits and fetches | 8 globally, 6 per normalized requested hostname |
| Fetches open to rank 1 / rank 2 | 6 / 4 globally, 4 / 3 per hostname |
| Host backoff | 256 hosts; two failed reads in a row answer fallback at once for 60 seconds |
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
Focused page and transport tests cover the session cache bounds, stale replies, hide/return, ranks, fallback and
bounded replay; redraw tests cover decoded node identity, motion transitions, capacity deferral, queued native work
and account removal. Native tests cover rank order, reserved fetch slots and host backoff.
Original-source and mutation controls prove the routing, LRU, queued-body and retiring-permit assertions can fail.
Earlier private-branch production-Worker controls cover concurrent IDB writers, both cache caps, cancellation, real bitmap closure,
actual Blob delivery through both transports, page disposal and full-process cache reuse. A separate real quota
denial/restoration control observes usable ephemeral Blobs and write backoff. Failed fixture attempts remain recorded.
The controls do not establish indefinite leak freedom, physical database limits, or storage recovery after backoff expiry.

## Measured limits and follow-up

2026-11-28, loopback only, 390 by 844 at DPR 3: 140 authors (10% without a picture, 15% on a host without CORS),
720 notes, relay answers after 60 ms, pictures after 140 ms (CORS) and 260 ms (no CORS). A probe samples every
frame after layout and counts frames in which an on-screen face whose picture was already drawn shows the letter.

| Chromium 1243 | 3b5ae3a4 | this change |
| --- | ---: | ---: |
| Scripted flings over 720 mounted rows, frames with a known face missing | 621 of 706 | 0 of 706 |
| Wheel and touch flings, same | 229 of 569 | 0 of 569 |
| After a tab hide/show round trip, same | 243 of 405 | 0 of 404 |
| Picture requests reaching the two hosts in the whole run | 660 | 234 |

Cold median time-to-face and the WebKit runs are in the task report; they are one machine's loopback numbers.
The probe reads the DOM (a complete image with pixels), not composited frames, and it cannot reproduce iOS
discarding decoded images or a whole background tab. Owner-device behavior stays the final check.

A host without CORS still costs one failed anonymous read before the plain image starts, until two failures in a
row mark the host for a minute. The engine does not yet start a face before the page asks for it; the page asks
for the whole mounted window as soon as rows mount, which is where the Worker's rank scheduling takes over.
