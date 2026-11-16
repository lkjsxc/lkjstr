# Media uploads

## Purpose

Upload destinations, failure recovery, protocol bounds and verification.

## Browser behavior

The Post composer keeps a failed File and its text in the mounted draft. A
failure names the destination and a translated reason, with Retry and a server
selector. Failed attachments block posting until retried or removed. Successful
attachments become URLs and imeta tags when the post is sent.
Retries preserve the chosen destination when an error message is plain text;
only a reported server URL replaces it.

Progress names discovery, signer permission, upload or deferred processing.
Byte progress remains honest: zero until the response has been validated, then
complete. A retry reads a fresh ArrayBuffer from the retained File because the
previous buffer was transferred to the Worker.

The Worker tries the first server in the owner's list without a fresh required-
request failure, in list order. The signed event size bounds this candidate
list. A failed required request permits
trying the next; an explicit retry destination stays fixed. Fallback uses only
the current attempt; signer failures stop even when another attachment marks
the same destination down. If every destination is down, the first configured
server and its failure are returned; an empty owner list alone is not-found.
Settings and the composer picker share the same session evidence. Unknown/checking rows are muted
and show their known protocol or Not confirmed. A failure shows Not answering,
its translated upload reason and a row Retry. Success clears the failure at once.
Verdicts are never persisted or restored. Retry checks required NIP-96 discovery
or optional BUD-06 HEAD /upload; an unsupported/failed optional HEAD stays unknown.
No root GET, favicon or short health deadline decides the mark. Failed protocol
discovery preserves the known protocol; only success can replace it.
The defaults and Settings choices are blossom.band, blossom.primal.net,
nostr.build and nostrcheck.me, in that order. An explicit empty owner list remains
empty in the engine. Changing a retry destination does not publish a server list.

## Protocol and bounds

Blossom uses PUT /upload, raw bytes and a signed kind 24242 authorization with
upload, file hash and expiration tags. Configured base paths are retained:
/blossom becomes /blossom/upload; an explicit /upload suffix is used once.
NIP-96 uses discovery, multipart POST and
kind 27235 NIP-98 auth for the exact API URL and method. The browser supplies the
multipart boundary. The known NIP-96 default goes directly through discovery;
unknown servers fall back only when Blossom is absent or its preflight fails.
Refusals, payment requirements and invalid metadata are visible failures.

There are four concurrent Worker uploads, each at most 20 MiB. An implicit
server-list lookup waits at most 15 seconds. Signers wait at most 60 seconds;
Uploads share a 30-second abort deadline for headers and response bodies,
with a 64 KiB response limit; required discovery and processing GETs also
allow 30 seconds. Discovery follows at most two documents. Deferred NIP-96
processing polls at most six times, with one-second pauses and bounded HTTP.
One monotonic 285-second Worker deadline starts when the action arrives and covers all
lookup, signer, HTTP, processing and fallback waits. Each wait is capped by the
remaining budget; expiry stops fallback and late signing replies are discarded.
The page settles lost replies after 300 seconds, leaving 15 seconds for dispatch.
View disposal releases the server-list subscription; HTTP timers and remote sockets have
settlement cleanup. Protocol 7 adds acknowledged cancellation through the existing removal/clear controls.

## Evidence

The public-network sample is manual and excluded from every gate. It uses the
real engine, a small PNG, throwaway accounts, the production origin and CSP with
locally served assets, and loopback relays only. No notes or lists are published
to public relays. Before/after records and cleanup outcomes live in ignored
`tmp/upload-report.md`; machine observations are in `tmp/uploads-*.json`.

Both smoke gates run real loopback TLS media servers with real cross-origin
preflights, required auth headers, 11-second replies (beyond the old deadline),
refusals, malformed metadata,
deferred processing, file retention and retry. The full real smoke additionally
checks stalled headers/bodies and the upload signing deadline. All three account
signers are exercised. The ordinary smoke additionally checks the mock UI;
smoke:real checks the complete real product. Fixture ports and TLS paths are
unique per run. Public HTTP is blocked in these gates.

Protocol references checked for this repair:

- https://github.com/hzrd149/blossom/blob/master/buds/02.md
- https://github.com/hzrd149/blossom/blob/master/buds/06.md
- https://github.com/nostr-protocol/nips/blob/master/96.md
- https://github.com/nostr-protocol/nips/blob/master/98.md
- https://blossom.band/ (endpoints and free upload limits)
- https://nostr.build/.well-known/nostr/nip96.json
- https://blossom.primal.net/ (implemented BUDs)
- https://github.com/quentintaranpino/nostrcheck-server

## Cancellation lifetime

The original request owns one client-scoped lease. Cancellation consumes it
before aborting queued authorization, the HTTP request/body, processing polls
and signer waits. A stale completion cannot produce progress, health evidence,
fallback or a second terminal result. Reusing a request in another port creates
a separate job. Signer request identifiers keep their CSPRNG nonce across Worker
replacement. Already-open extension permission dialogs cannot be closed by the
page; their late replies are discarded. Already accepted remote blobs remain.

The loopback cancellation fixtures hold response headers/bodies and processing
polls. Their small request body does not measure cancellation midway through a
large transmitted body; that separate measurement remains outstanding.
