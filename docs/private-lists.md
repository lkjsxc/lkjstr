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

Primary contracts: [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md),
[NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md),
[NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md),
[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) and
[NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md).
