# Direct message engine

## Purpose

Describe the private-message engine boundary and the capabilities awaiting
Claude's conversation, composer and inbox-settings specifications.

## Contract

Protocol 6 adds a separate private subscription family. `dm.open` carries a
`sub` and `query: {account, conversation?, before?, limit?}`. The account must
have an available signer. A conversation key is the SHA-256 of sorted member
public keys joined with colons; it is stable across NIP-17 and older messages.
`before` is a returned message ID and `limit` is clamped to 1..200. Reopening
with a new cursor changes the local window; `dm.more` requests older encrypted
relay pages. `dm.visible`, `dm.close`, detach and hidden-tab hints release wants.
Hiding keeps the query anchor and cached rows, but currently drops network
history cursors, so reopening can rewalk cached relay pages before extending
older history. Preserving cursors with account/advertised-route pruning is next.

A `dm` answer contains `sub` and `snapshot`: account, conversations, messages,
more, undecryptable, phase and optional error. Conversations contain key,
participants, last and unread. Messages contain id, conversation, author,
participants, at (milliseconds), text, replyTo, subject, `legacy` and unread.
replyTo and subject are null when absent. A conversation list is capped at 200;
conversation previews contain the last message; message windows are returned
only for the requested conversation. Unread counts
are local observed counts, not proof that every historical relay event arrived.

`dm.send` takes `as` and `draft: {recipients, text, replyTo?, subject?}`.
`dm.seen` takes `as` and `conversation`; success follows the read-mark disk
transaction. `dm.relays.save` takes `as` and `relays` and publishes kind 10050.
These use the existing correlated `result` with actual delivery information.

## Encryption and routing

The engine creates an unsigned kind-14 rumor, signs a kind-13 seal, and sends
one distinct kind-1059 gift wrap to every participant, including the sender.
Seal and outer timestamps each use independent random offsets within 48 hours;
every outer event uses a fresh ephemeral key and fresh NIP-44 nonce. Only
verified kind-10050 inbox URLs receive wraps. Missing, invalid, empty or oversized
inbox lists fail preparation before any wrap is published. Ordinary kind-10002
outboxes and bootstrap relays are never fallback destinations for private text.

Local keys use Rust NIP-44. NIP-07 and bunker accounts use the same validated
seal pipeline through their NIP-44 encrypt/decrypt and exact-event signing APIs.
The additive `crypt` / `crypted` request pair supports extension crypto without
parsing Nostr events in the interface. The extension public key is checked before
every operation. Missing capabilities and refusal are explicit failures; they
never produce a fake empty conversation or silently change encryption formats.

The receive pipeline verifies the outer signature and recipient, seal signature,
rumor ID, unsigned rumor, author equality and participant membership. Duplicate
wrappers of the same rumor count once. Invalid envelopes increment the bounded
account's undecryptable count. Older kind-4 messages are readable with local,
extension or bunker NIP-04 decryption. There is no older write API.

Sending completes only after at least one listed inbox relay accepts each
participant's wrapper, including the sender's archive copy. Partial delivery is
reported as failure with its actual per-relay outcomes. A retry may produce a
new rumor; the engine does not claim atomic cross-relay delivery.

## Private lifetime and bounds

Only signed encrypted envelopes and public relay-list events enter the shared
store and IndexedDB event cache. Decrypted rumors never become public query
rows, raw-event outputs, cache events or diagnostics. They live in a separate
account-keyed in-memory inbox and are discarded when the account is locked or
removed, or when the Worker terminates. Every committed access change invalidates asynchronous account leases, so a
late signer reply cannot revive a locked session. Read markers store timestamps and IDs,
not text, under the device-local `dm-seen-v1` key. Lock retains those markers.
A read-marker load failure stays failed until an explicit reopen retries it;
unknown durable unread state is never replaced by default counts.
Existing older unencrypted local keys are unchanged; see [keys.md](keys.md).

Bounds are 32 private views, 32 participants per message, 16 KiB text,
256 queued envelope IDs, two simultaneous decrypt jobs, four queued/running
writes, eight crypto requests, 8000 decrypted account/message pairs, 20000
attempted envelope/account pairs, and 4096 account/conversation read markers.
Crypto calls have unique random request IDs and a 60-second deadline; signing
shares the existing 285-second
signer deadline. Wants disappear with the last visible private subscription.
Read cursors are per account and inbox relay, plus one shared older cursor;
public network scheduling and
connection limits continue to apply. The encrypted cache follows the existing
16000/4000 memory and 20000 physical-event limits.

## Limits that need design or more work

No conversation surface, DM composer, inbox-settings control or unread badge is
introduced. `Engine.dm` exposes the private callback channel for a specification.
Opening an extension inbox can require two decrypt permissions per gift wrap;
no background extension prompts occur without a visible private subscription.

History uses inclusive second boundaries to avoid silently skipping envelopes
with equal timestamps. A relay page saturated entirely by a single second can
stall rather than prove completeness. Older archive reads keep separate live
requests and advance history through the shallowest completed full relay page.
Group metadata edits, private files, reactions,
message deletion, read receipts and cross-device read-marker sync are not added.
Unread markers are a local timestamp watermark with tie IDs, so an older event
arriving after a newer message was marked read is treated as read.

## Evidence

Native tests cover account isolation, deduplication, persisted unread ties,
older decryption, signer-layer validation, routing refusal and locked-session
plaintext eviction. The loopback Worker conformance helper exercises local,
NIP-07 and bunker encryption, receipt routing, group delivery and release of
private wants. A one-slot scheduler regression fails before DM slot rotation
and passes after it; separate regressions cover the 48-hour reconnect window
and future-dated envelope watermark poisoning. Browser public-relay tests never
send messages or sign broadcasts.
Specifications: [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md),
[NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md),
[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), and
[NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md).
