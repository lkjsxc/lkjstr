# Direct message engine

## Purpose

Describe the private-message engine, its implemented interface and its remaining
limits. [frontend-dm.md](frontend-dm.md) records the M1-M6 surfaces specified in
[interface-dm.md](interface-dm.md). Draft storage, signer lifetimes and cross-page
locking have separate contracts linked below.

## Contract and interface

Protocol 6 introduced the private callback channel, separate from public rows.
Protocol 7 made initial `dm.open.visible` atomic. Protocol 8 adds display fields,
participant queries, encrypted draft recovery and private editor coordination.
Existing messages and fields remain available.

`dm.open` carries a sub and query with account, optional conversation, before
and limit. `participants` opens a new canonical member set without making the
interface hash it. The engine's key is SHA-256 of sorted member public keys
joined with colons and is stable across wrapped and older messages. `before`
is a returned message ID; limits are clamped to 1..200. `dm.more` requests
older encrypted relay pages. `dm.visible`, `dm.close`, detach and page hints
release unused network wants.

A private snapshot contains account, conversations, messages, more,
undecryptable, phase and an optional error. Display additions include the
conversation key, public people, blocked participants and total unread count.
A list is capped at 200 conversations. Each row contains its participant set,
last message and observed unread count. Message windows are supplied only for
the requested conversation. Unread counts do not prove relay completeness.

Messages carry IDs, author, participants, millisecond time, text, replyTo,
subject, `legacy` and unread. Absent replyTo and subject are null. The engine
also supplies parsed text segments, known reply excerpts and recent group
authors. The frontend draws links without private media or link previews.
`unreadOnly` returns counts without message bodies or conversation previews;
the frame watch uses it only with protocol 8.

`dm.send` takes an account and a draft containing recipients, text and optional
replyTo, subject and custom emoji. `dm.seen` succeeds after its read-mark disk
transaction. `dm.relays.save` publishes the account's kind-10050 inbox list;
an empty list explicitly withdraws those routes. `Account.inbox` supplies a
known current list. Omission is not evidence of an empty list; a list query's
settled unsupported/not-found result separately proves missing own inboxes.

Messages, conversation tabs, the private composer, inbox settings, signer
consent and the account unread mark now have their prescribed surfaces. An
existing setup row remains available when a private query proves missing
inboxes before the account field is populated. Sign-in, read-only, locked,
loading, failed and unsupported states use the supplied bilingual words.

## Encryption and routing

The engine creates an unsigned kind-14 rumor, signs a kind-13 seal and sends
one distinct kind-1059 gift wrap to each participant, including the sender.
Seal and outer timestamps use independent random offsets within 48 hours.
Every outer event has a fresh ephemeral key and NIP-44 nonce. Only verified
kind-10050 inbox URLs receive wraps. Missing, invalid, empty or oversized lists
fail preparation before publication. Public outboxes and bootstrap relays are
not fallback destinations for private text.

Local keys use Rust NIP-44. Extension and bunker accounts use the same checked
seal pipeline through NIP-44 encrypt/decrypt and exact-event signing. The
`crypt` / `crypted` pair keeps event parsing out of the frontend. Extension
identity is checked before and after its awaited crypto operation. Missing
capabilities and refusals are explicit; no encryption downgrade occurs.

Receive verifies the outer signature and recipient, seal signature, rumor ID,
unsigned rumor, author equality and participant membership. Duplicate wraps of
one rumor count once. Invalid or unprojectable envelopes increment the bounded
account's undecryptable count. Older kind-4 messages can be read with local,
extension or bunker decryption. There is no older-format write action.

Send succeeds only when at least one advertised inbox accepts each person's
wrap, including the sender's copy. `Result.dmDelivery` counts accepted and total
participants; relay results never stand in for people. Partial delivery is a
failure with its actual outcomes. Retry can create a new rumor and never claims
atomic cross-relay delivery. The interface keeps the failed row even when the
sender's own copy has arrived, and never retries it automatically.

## Drafts and account lifetime

Only signed encrypted envelopes and public relay-list events enter the shared
event store. Decrypted messages stay in the account-scoped inbox and private
view; they never become public query rows, raw-event output or diagnostics.
Lock, removal, signer replacement and Worker stop invalidate the original
account/client identities before delayed effects can reuse private state.
A hidden or closed reading view releases its read jobs and network wants.

Read markers contain timestamps and IDs under the local `dm-seen-v1` key.
Lock retains them. A marker-load failure stays failed until explicit reopen;
unknown durable unread state is not replaced with invented default counts.
Existing unencrypted local keys keep their explicit migration path in
[keys.md](keys.md).

The encrypted archive actions load, save and clear per-account, per-tab draft
state. Initial writable load establishes a wrapped seed before accepting text.
Save/clear acknowledge committed storage and carry an optional expected
revision. An unrelated writer's edit is not silently overwritten. Private
text never enters preference storage or the public composer. Details, segment
validation, removal generations and concurrent-write limits are in
[dm-drafts.md](dm-drafts.md).

A private editor must register before accepting input. Cross-page Lock holds
all participating editors and prepares them one page at a time, with serialized
writers. The latest draft and terminal send state must commit before a clean
acknowledgement. The whole preparation has a 15-second limit; failure retains
the text and leaves the key unlocked. Unexpected expiry preserves an unresolved
lease until its original editor returns. See [dm-editor-locks.md](dm-editor-locks.md).

Signer refusal hides the private view while retaining its authorized unsaved
editor and pending send. Retry reattaches that store. Actual account revocation
purges it. A lost save acknowledgement can refresh a revision only against the
exact prior confirmed or attempted archive state, preserving newer local text.
These are lifecycle guarantees, not a claim to zeroize every caller-owned
JavaScript string.

## Signer scheduling and bounds

Private crypto is serialized per account. The first refusal, unsupported
operation or actual private crypto deadline pauses that account before another
queued prompt starts. Explicit reopen/Retry clears that pause. Hidden read
jobs are cancelled; explicit sends and archive operations have their own
lifetimes. An already opened extension dialog cannot be dismissed by the page.
See [dm-signers.md](dm-signers.md) for native decisions and measured proofs.

Each active external crypto or seal-signing wait is capped at 60 seconds,
within the remaining 285-second operation budget. Queueing spends that same
budget. Actual private crypto, seal and inbox-advertisement signing deadlines
report `signer-timeout`. Private bunker signing preserves authenticated
unsupported/refusal results; socket loss remains `signer-missing`. A signer's
error text cannot manufacture an actual deadline. Late exact-event signatures
cannot publish or settle a completed action again.

Engine bounds include 32 private views, 32 participants, 16 KiB send text,
256 queued envelope IDs, two simultaneous receives, one receive per account,
four queued/running writes, eight external crypto requests, 8000 decrypted
account/message pairs, 20000 attempted envelope/account pairs and 4096
account/conversation read markers. Draft and editor bounds are documented in
their linked contracts. Public network connection limits continue to apply.
The encrypted event cache retains the existing 16000/4000 memory and 20000
physical-event limits.

## Remaining limits

Hiding keeps the view's reading anchor and cached rows, but currently drops
network history cursors. Reopening may rewalk cached relay pages before older
history extends. Cursors are scoped by account and inbox relay, plus the shared
older-format cursor. Preserving them across hiding needs bounded pruning by
current account and advertised routes.

History uses inclusive second boundaries. A page entirely saturated by one
second can stall without proving completeness. Older reads retain separate
live requests and advance through the shallowest completed full relay page.
A read watermark treats an older event arriving after a newer message was
marked read as already read.

Group subject/metadata editing, private files, reactions, message deletion,
remote read receipts and cross-device read-marker synchronization remain
unimplemented. Displaying a received subject does not add a subject editor.
Separate dedicated Workers do not provide instant shared unlock authority;
the archive's removal generation protects its narrower in-flight write race.

## Evidence

Native tests cover isolation, deduplication, unread ties, older decryption,
signer-layer checks, routing refusal, verified-delivery counts, asynchronous
revocation and encrypted archive concurrency. Loopback Worker tests exercise
local, extension and bunker encryption, group routing, first-refusal draining,
actual private crypto deadlines, hidden-read cancellation and shared editor
locking. Frontend tests and the real UI proof are in [frontend-dm.md](frontend-dm.md).
The private-signing regression uses the real production Worker and triggers its
original requested 60000 ms timer callback. It covers extension and bunker seals
and inbox advertisements, late replies, refusal, unsupported operation and socket
loss; it does not claim that 60 seconds elapsed in the fixture. On 2026-11-16 at
10:53 UTC the fixed package passed 22 checks in 2.663 seconds, at load
1.85 / 2.40 / 3.68. Five checks failed against the earlier frozen package.
Run `node scripts/engine-dm-sign-deadline-harness.mjs`; the immutable before/after
reports are under `tmp/dm-sign-deadlines`. Public-relay endurance checks never send
private messages or sign broadcasts.
Specifications: [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md),
[NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md),
[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), and
[NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md).
