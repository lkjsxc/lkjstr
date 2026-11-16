# Private list reads

## Purpose

Read the encrypted parts of current signed mute, bookmark and named people
lists without exporting keys, mixing account scopes or changing Messages
consent. Public list tags remain available while private work is pending.

## Contract

A query with `privateLists: true` permits external reads for its acting
account. The ordinary `open.visible` field makes the initial visibility
atomic. Existing Mutes and account feed controls opt in; a hidden or closed
view cannot start an external decrypt. The transport restores page visibility
before replaying these queries, including the actual hidden document state.

The Worker sends the existing `crypt` operation with optional
`context: {kind: "private-list", sub, event}`. The main thread checks the
owned visible query, account, self peer, operation and signed event ID before
calling an extension. `crypt.cancel` consumes that request's lifetime.

NIP-07 and NIP-46 use NIP-44 decrypt, or historical NIP-04 decrypt selected by
the signed payload's structure. A failed decrypt never falls back to another
algorithm. There is no production NIP-04 encryption operation.

`SubState.privateLists` has a phase, pending/failed list counts and an
optional stable error code. These counts describe list containers, not tags.
Relay EOSE does not complete private decryption. Existing loading/failure
nodes show private dependency state; available public rows stay available.
Dependency-only updates retain the last relay phase and counters actually
observed for this query. Both private-list and zap evidence are projected
from current engine state at emission. Opening a replacement query clears
the prior phase; initial rows cannot invent a relay completion state.
Each logical Open resets relay observation suppression without restarting
shared requests or cursors. An undelivered prior-query State is discarded;
current relay completion can seed the new query's dependency updates.

`lists.retry {as}` explicitly resets this account's private-list failures.
The Messages consent preference and refusal state are separate. List reads
share the bounded private signer executor with Messages, so they cannot open
concurrent calls for the same account.

## Local notification policy

Unlocked local accounts' current encrypted mute lists are also a policy
dependency of saved-account unread counts. The Worker resolves these local
reads synchronously through the same cache before emitting account rows.
No visible feed is required, and another active account does not change
which owner's mutes apply. This path never delegates to an external signer.

`Account.privateLists` qualifies the compatible numeric `unread` field.
For an observed encrypted mute list, `unknown` means no eligible work is
currently admitted; `loading` means queued or running work. Actual failed
attempts report `failed`, unavailable algorithms/read-only accounts report
`unsupported`, and a resolved observed dependency reports `ready`.
The number can include privately muted notifications until the dependency
is ready. This field does not claim that every relay has supplied its newest
mute list.

External accounts never gain background decrypt prompts merely because an
account row or unread count is needed. Locked local keys also do no work.

## Cache and lifetime

Successes and terminal failures are cached by signed event ID and account
availability epoch. Unrelated public Store insertions do not redo crypto.
Current replacements, key authority changes, lock, removal and Worker stop
retire obsolete entries. A late result must match the exact job, account,
event and current visible demand; revoked plaintext is discarded.

Private tags remain in the existing in-memory private map. They do not enter
the public event store, persisted public event records or diagnostics.
Existing account-scoped row and hydration boundaries remain in force.
Successful authority revocation clears derived private rows and private
anchors before account/action acknowledgements.

The shared tag cache admits at most 128 current records and 16 MiB of retained
Vec/string allocation. Each private section has at most 8192 tags, 32 fields
per tag and 32768 fields in total. Excess is rejected, never silently
truncated. Payload limits also apply before parsing.

There are at most two asynchronous list effects, one per account. Local mute
policy has a bounded synchronous pass over at most 32 accounts. All external
private crypto shares the existing eight-call Worker gate and the bounded
main-thread executor. Each signer call has a 60-second bound; the whole list
job has a 90-second lifetime. Job expiry is distinct from an actual signer
timeout and cannot invent successful completion.

Closing or hiding a view cancels queued work and invalidates responses.
An already open extension dialog cannot be programmatically dismissed.
The frontend rechecks the request lifetime after each awaited signer call,
so revocation or expiry cannot start a later decrypt or identity-check call.
This cancellation does not set the Messages refusal state.
Successful cached data can remain available across a hidden visit while the
account remains authorized. Cache saturation reports `too-large`; explicit
Retry does not evict successful data. Account revocation or a new Worker
lifetime releases that account's cache.

## Limits

This is a read feature. It adds no private-list editor or new list surface.
Named people sets are available through the existing raw list query, but no
named-set navigation surface exists. Public editing controls retain their
existing write rules. They do not silently publish decrypted private tags.

There is no new Retry button: the additive action is available for Claude's
next specification. Unsupported signer methods remain unsupported. Existing
clients/Workers that omit the additive fields retain their earlier behavior.

## Verification

The first native pass covered four bounded codec cases and fifteen read,
lifetime, purpose and wire cases. Five further local-policy cases cover
no-view demand, another active account's notification count, dependency
states and the absence of background external work.

The no-view regression compiled and failed before the local-policy correction
at 13:11:15 UTC on 2026-11-16: two failures and one negative control pass.
The corrected twenty core tests and strict core/NIPs clippy passed; the
production Worker package was built at 13:16:40 UTC, load 1.80/1.83/2.01.
Raw native logs are under `tmp/private-lists/`. The finite real-Worker suite
passed 30/30 checks at 13:33:09 UTC on 2026-11-16 in 7.989 seconds, load
1.37/1.59/1.78. It used the frozen production package whose WASM SHA-256 is
`9527440bed31934fea58922b70549dacbc7f6290ec562082e22f907c4acd1940`.
The report is `tmp/private-lists-run5/report.json`.

Those checks use fresh local, extension and bunker accounts, signed loopback
lists and real NIP-44/NIP-04 decrypts. They cover no background external
prompt, hidden admission, cancel/reopen, late reply rejection, refusal/Retry,
lock/unlock, account removal, cache reuse after an observed public insertion,
no plaintext in public records and no ordinary relay publication.

Four earlier runs stopped at a fixture route mismatch: its raw relay target
omitted the canonical trailing slash. Their reports remain unchanged under
`tmp/private-lists-run1` through `tmp/private-lists-run4`; the passing run
changed only that fixture URL, not the compiled Worker. Eleven frontend
access/mock tests and 21 transport/history tests also pass.

The frontend await-boundary regression failed in all nine cases before its
correction at 13:53:57 UTC on 2026-11-16; all 22 adjacent cases then passed.
The protocol-10 integration reproduced three independent state-composition
failures at 14:08:39 UTC in 9.889 seconds, load 3.53/3.02/2.83. Its reverse-order
control passed before the correction. All four composition cases and ten
adjacent native cases passed afterward, together with the Worker WASM check,
at 14:09:32 UTC in 10.463 seconds, load 2.74/2.89/2.80. Evidence is under
`tmp/private-state-{before,after}.{log,json}` in the integration worktree.
The merged frontend check passed at 14:08:09 UTC in 6.168 seconds. Repository,
native and rust-wasm gates then passed before the upstream startup packaging
rebase. The merged protocol-10 browser suite and remaining release gates are
pending; [engine-private-verification.md](engine-private-verification.md)
records exact timings, artifact boundaries and the remaining commands.

The first merged Worker attempt exposed a same-sub replacement hole: clearing
query metadata without resetting relay observation suppressed the next State.
Three native cases failed at 15:12:45 UTC in 0.779 seconds, load 0.97/1.55/1.94;
close/reopen controls passed. After resetting only the logical observer,
all five new and sixteen adjacent cases passed at 15:13:41 UTC in 4.764
seconds, load 1.38/1.60/1.94. The signer remains unanswered while the browser
fixture waits for the independent relay State. It cannot certify loading
from a fabricated phase or a completed decrypt. Evidence:
`tmp/sixth-reopen-{before,after}.{log,json}`. The merged rerun is pending.

Primary contracts: [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md),
[NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md),
[NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md),
[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) and
[NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md).
