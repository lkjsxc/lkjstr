# Remote signer authorization

## Purpose

Implement NIP-46 intermediate authorization challenges without transferring
signer tokens to unrelated pages or interpreting them as completed RPCs.
The primary contract is [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md).
This is an integration candidate; verification remains pending below.

## Verified intermediate responses

The protocol verifies the signed kind-24133 event, remote peer, recipient and
random request correlation before classifying its decrypted response. An
`auth_url` response keeps the same RPC listening for its later final response.
It does not create another RPC or extend its deadline. Ordinary provider
errors retain their existing refusal/unsupported mapping.

URLs are limited to 4 KiB. HTTPS is accepted; HTTP is accepted only for literal
127.0.0.1 and [::1] authorities. Credentials, whitespace, control characters,
backslashes and other schemes are rejected before exposure. The engine never
fetches a challenge URL or opens a window. Authorization still requires the
future interface specified by Claude.

## Ownership and lifetime

Core policy admits at most 64 pending calls, with at most 16 per client. Each
call permits four distinct URL challenges; an identical URL has no additional
output. Calls retain the earlier of their operation deadline and the existing
60-second RPC limit. Every socket and abort listener has a completion path.

Opaque UI handles combine a checked job counter and 128 fresh random bits.
Raw RPC identifiers, client secrets and bunker connection credentials are not
included. The verified signer peer remains available before account discovery.
The optional action request is the caller's existing public correlation.

| Caller | Proven authority |
| --- | --- |
| Connect and public-key discovery | Initiating client and account action |
| Ordinary signing | Namespaced core action, exact event and original deadline |
| Upload and zap signing | Initiating client plus the existing aborting operation |
| Private signing | Initiating client, account generation and operation deadline |
| Private crypto | Existing DM/list purpose lease, account generation and abort signal |

An account removal or credential replacement, a detached/expired client,
private read close/hide, explicit cancellation and Host stop revoke pending
work. Late messages cannot restore a removed lease. Clear precedes an ordinary
terminal reply. Permanent Host stop first closes output ports, then drops the
book and aborts sockets, so it produces no new client messages.

The book is never serialized. URLs are omitted from event storage, accounts,
diagnostics and measurement reports. Native debug representations redact the
URL. The client retains at most 16 temporary intents, clears them on connection
loss/disposal and does not replay them after Worker replacement.

## Transport limits

Direct MessagePorts carry the challenge only to its initiating page. The
fallback leader intercepts any follower challenge before BroadcastChannel
serialization and cancels it as unsupported. No URL bytes are broadcast.
The leader's own local port and SharedWorker clients retain support.

A relay authentication job has an account but no proven initiating page. It
continues using existing preauthorized bunker signing; an interactive URL is
unsupported. Selecting an arbitrary live tab would disclose an authorization
token to a page that did not request it. A future explicitly owned relay flow
or private fallback channel can remove these limitations.

## Verification

Eight focused client/mock tests passed after the final URL-deduplication
refinement. The full web check passed at 2026-11-16 15:40:27 UTC in 6.297
seconds, load 2.51/2.49/2.30. All 46 transport tests passed at 15:37:18.
The follower-URL regression fails on unchanged transport and passes with
interception. The four new transport cases prove direct ownership, follower
redaction, the leader's private route and retired-connection rejection.
Evidence is in `tmp/auth-web-proof/` including the failing-before log.
Native compatibility, verified response, bounded lifetime and real Worker
regressions remain unrun in this candidate.
`scripts/engine-bunker-auth.mjs` is a finite two-port real-WASM fixture using
fresh native keys, one loopback origin and a strict public-network guard.
It covers discovery, public/private signing, private NIP-44/NIP-04 reads,
owner cancellation, account removal, original deadlines and retained Host stop.
Its timer trigger tests the original callback; it is not a wall-clock latency
measurement. The fixture never navigates to an authorization URL.

No new visible words, layout or styles are part of this capability.
