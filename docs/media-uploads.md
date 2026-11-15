# Media uploads

## Purpose

Upload destinations, failure recovery, protocol bounds and verification.

## Browser behavior

The Post composer keeps a failed File and its text in the mounted draft. A
failure names the destination and a translated reason, with Retry and a server
selector. Failed attachments block posting until retried or removed. Successful
attachments become URLs and imeta tags when the post is sent.

Progress names discovery, signer permission, upload or deferred processing.
Byte progress remains honest: zero until the response has been validated, then
complete. A retry reads a fresh ArrayBuffer from the retained File because the
previous buffer was transferred to the Worker.

The composer selects one destination, using the owner's first configured server
before the built-in choices. The Worker no longer silently walks eight servers.
Untested Settings rows say Not confirmed, not Not answering: no health probe
has taken place. Only a successful upload confirms the protocol.
The defaults and Settings choices are blossom.band, blossom.primal.net,
nostr.build and nostrcheck.me, in that order. An explicit empty owner list remains
empty in the engine. Changing a retry destination does not publish a server list.

## Protocol and bounds

Blossom uses PUT /upload, raw bytes and a signed kind 24242 authorization with
upload, file hash and expiration tags. NIP-96 uses discovery, multipart POST and
kind 27235 NIP-98 auth for the exact API URL and method. The browser supplies the
multipart boundary. The known NIP-96 default goes directly through discovery;
unknown servers fall back only when Blossom is absent or its preflight fails.
Refusals, payment requirements and invalid metadata are visible failures.

There are four concurrent Worker uploads, each at most 20 MiB. An implicit
server-list lookup waits at most 15 seconds. Signers wait at most 60 seconds;
Uploads share a 30-second abort deadline for headers and response bodies,
with a 64 KiB response limit; discovery and polling GETs have 10 seconds. Discovery follows at most two documents. Deferred NIP-96
processing polls at most six times, with one-second pauses and bounded HTTP.
The page also settles lost upload replies after 300 seconds. View disposal
releases the server-list subscription; HTTP timers and remote sockets have
settlement cleanup. Cancellation remains outside the contract.

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
- https://github.com/nostr-protocol/nips/blob/master/96.md
- https://github.com/nostr-protocol/nips/blob/master/98.md
- https://blossom.band/ (endpoints and free upload limits)
- https://nostr.build/.well-known/nostr/nip96.json
- https://blossom.primal.net/ (implemented BUDs)
- https://github.com/quentintaranpino/nostrcheck-server
