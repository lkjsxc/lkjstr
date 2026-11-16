# Remote signer authorization

## Purpose

Implement NIP-46 intermediate authorization challenges without transferring
signer tokens to unrelated pages or interpreting them as completed RPCs.
The primary contract is [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md).
Focused proofs and merged gates passed; authorization still awaits its designed surface.

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
future interface specified by Claude. The current client rejects such a request
as unsupported when no authorization presenter is registered, rather than
retaining a hidden wait that the user cannot finish.

## Ownership and lifetime

Core policy admits at most 64 pending calls, with at most 16 per client. Each
call permits four distinct URL challenges; an identical URL has no additional
output. Calls retain the earlier of their operation deadline and the existing
60-second RPC limit. Every socket and abort listener has a completion path.
Discovery preserves its two pre-existing sequential budgets: connect may use
60 seconds, then get_public_key may use another 60 seconds. An intermediate
challenge never restarts either budget; there is no new account-action timer.

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
work. Late messages cannot restore a removed lease. Public signing captures its
authority before scheduling the async task; identical replacement credentials
cannot grant that old task a new account generation. Split-zap challenges
inherit the remaining original 90-second operation budget as well as the RPC
limit. Clear precedes an ordinary terminal reply. Permanent Host stop first
closes output ports, then drops the book and aborts sockets, so it produces no
new client messages.

The book is never serialized. URLs are omitted from event storage, accounts,
diagnostics and measurement reports. Native debug representations redact the
URL. The client retains at most 16 temporary intents, clears them on connection
loss/disposal and does not replay them after Worker replacement.

A live `pending.subscribe` callback is a presenter lease. Subscribe before
starting an action, and dispose that subscription when its surface closes.
The last presenter leaving clears retained URLs/timers and sends the existing
unsupported cancellation. Multiple presenters retain independent leases;
connection reset clears intents but does not detach a still-mounted presenter.
No new visible word, control or protocol message is needed for this boundary.

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
On 2026-11-16 the original response implementation compiled and failed the
intermediate-response assertion. The candidate passed five protocol and nine
core policy tests plus both focused strict Clippy checks in 14.860 seconds at
17:56:54 UTC, load 1.62/2.28/3.10. Production and harness Worker WASM strict
Clippy passed in 6.297 seconds at 17:57:23, load 2.05/2.32/3.08.
Evidence: `tmp/auth-native-20261116T175654Z/` and
`tmp/auth-wasm-20261116T175723Z/`. Every source build refreshed and recorded
this worktree's Rust source and manifest mtimes/content hashes before using
the shared target; no stale other-worktree artifact was accepted.
`scripts/engine-bunker-auth.mjs` is a finite two-port real-WASM fixture using
fresh native keys, one loopback origin and a strict public-network guard.
It covers discovery, public/private signing, private NIP-44/NIP-04 reads,
owner cancellation, account removal, original deadlines and retained Host stop.
Its timer trigger tests the original callback; it is not a wall-clock latency
measurement. The fixture never navigates to an authorization URL.

The presenter boundary has three failing-before regressions and nine passing
controls on the unchanged client. The corrected client passed all twelve at
17:13:45 UTC in 0.665 seconds, load 3.13/2.61/2.05. Full web check then passed
in 6.477 seconds, ending at 17:13:52 UTC, load 3.74/2.76/2.10. The cases cover
absent/last presenters, supported pending intents, disposal and immediate
unsupported completion through the existing mock contract. An initial fixture
assertion counted the mock engine's independent startup timer; the final
comparison checks its unchanged baseline and zero timers after disposal.
Original source, all attempts and hashes are in
`tmp/auth-presenter-proof/` in the combined variants worktree.
This client-only proof is separate from the native and Worker checks below.

The `--boundaries` variant uses a harness-only single-task scheduling
barrier. It clones an existing saved Remote only inside Rust and runs the normal
account replacement policy, then authority synchronization. This deliberately
simulates identical device credentials with a renewed generation; ordinary
bunker import generates new device credentials. The queued action and original
deadline remain intact. A current-generation control must still sign normally,
and client detach or Host stop must release the barrier without remote work.
The controls compile only with the harness feature. Production build and app
packaging also inspect generated artifacts as described below.

A separate split-zap case preflights two providers, advances both fixture clocks
by 55 seconds while the first 60-second signature remains pending, then inspects
the later authorization. Its expiry must retain only the original 90-second
parent budget. An identical challenge cannot extend it; the parent deadline
must discard the partial invoice. HTTP responses are locally fulfilled and no
request is published or invoice paid.

The raw fixture passed 30 authorization/lifetime checks and 22 boundary checks
at 18:01:40 UTC in 11.478 seconds, load 1.92/2.37/2.95. The separate package
with only dispatch capture and inherited zap deadline disabled completed all
22 boundary checks: exactly the two product assertions failed, while 20
controls passed. That before run took 5.504 seconds at 18:01:34 UTC, load
1.83/2.36/2.94. Both use the same final fixture source; no threshold or assertion
was weakened. Browsers, sockets, native helpers and servers were reaped.

| Frozen harness package | SHA-256 |
| --- | --- |
| Corrected | `c435d9a6b589d7454244e9363d4f65c55409549080658040f69a5a4cd3af5a68` |
| Boundary guards disabled | `020c0a994c1a8afa6642dc5ee65b353e91159a511e537fa6638551e1fcaa1585` |

Package manifests and copied native helpers are under
`tmp/auth-freeze-20261116T175745Z/` and `tmp/auth-freeze-20261116T175819Z/`.
Final before/after reports are `tmp/auth-worker-20261116T180134Z/` and
`tmp/auth-worker-20261116T180140Z/`. Two earlier attempts are retained:
`tmp/auth-worker-20261116T175905Z/` correctly rejected missing LNURL address
metadata, and `tmp/auth-worker-20261116T180043Z/` queried a handler already
removed by Host stop. They are fixture failures, not complete product proofs.
Only the fixtures changed afterward; frozen runtime/helper hashes still match.
Four current auth transport cases also passed at 18:01 UTC.

The lasting `engine-check.sh` gate runs auth transport coverage plus both raw
Worker modes using its existing package and native fixtures. The combined
repository, main Worker and default real UI gates now pass; exact evidence is in
[engine-variants-verification.md](engine-variants-verification.md). Deployment remains unconfirmed.
## Production artifact boundary

`scripts/engine-production.ts` inspects actual WASM exports without
instantiating the module and parses generated bindings using the existing root
TypeScript parser. All 13 known conformance exports are rejected, including
benchmark, clock, test-relay, stop probes and the four new queue controls.
Default production builds and the real-app asset emitter enforce this check;
explicit harness builds retain their raw Worker test surface.

The original app emitter accepted a harness package and failed the new boundary
regression. All 18 cases pass with the guard. Actual immutable harness
`c435d9a6` bytes fail; canonical production `c7c7a7dd` bytes pass; production
WASM mixed with stale harness bindings fails. No original artifact was changed.
Evidence: `tmp/production-export-audit/run-20261116T181443Z/`.
The earlier `run-20261116T181356Z/` retains an AST implementation failure: the
web TypeScript package lacks that parser API, so the helper now uses the existing
root dependency. This failure is separate from the original-emitter proof.
Full web check passed at 18:15:40 UTC in 6.226 seconds, load 1.16/1.64/2.14;
record: `tmp/production-export-audit/static-20261116T181540Z/`.
That positive artifact predates this auth candidate. The current merged production
package also passes the export guard and exact archive audit; the dated combined
record above binds its distinct WASM and archive hashes.

No new visible words, layout or styles are part of this capability.
