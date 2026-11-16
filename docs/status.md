# Status

## Purpose

Current engine behavior and concrete limits. The source audit is
[parity.md](parity.md); measured network work is in
[engine-performance.md](engine-performance.md). Interface work belongs to Claude.

## Follow-up lifetime fixes (2026-11-16)

Protocol 7 adds atomic private-view visibility and acknowledged upload
cancellation. Existing attachment removal, clear and disposal cancel queued
authorization, HTTP response/body waits and processing polls. Late signer and
upload replies cannot settle a replacement job. Accurate intermediate transmitted
bytes remain unavailable; a remote blob already accepted is not deleted.

Successful account lock/remove now synchronously prunes decrypted private-list
policy and replaces derived rows, including hidden views, before acknowledgement.
Previously a query immediately after acknowledgement could use the old policy
until the next account-status pass. That was a transient memory/projection gap,
not evidence of durable plaintext. Failed account transactions preserve the prior
authorized state. Revoked private mute anchors are removed and rejected on replay.
Loss of signer access forces cache replacement even when a prior status pass
already cleared the private policy map. Ordinary seen/use actions retain the
cheap unchanged-authority path. External private-list decryption remains missing.

A recovering relay keeps its own unknown span without displacing a healthy live
fallback. Profile/count hydration retains its existing stable route behavior.
History and exhaustion wait for queued verification. Queue loss closes the
participating wire, revokes completion evidence and retries its unchanged span
with bounded backoff; hiding or removing the route releases that work. See
[engine-verification-pressure.md](engine-verification-pressure.md) for evidence.

Retained row diffs now index keys instead of repeatedly scanning the full list;
the normal real Worker reaches and physically stores all 5,000 loopback notes.
Thread ancestors precede their focus despite timestamp ties or clock skew.
All required gates and 338 real Worker checks passed; exact times, host load and
limits are in [engine-lifetime-verification.md](engine-lifetime-verification.md).

## Engine stream (2026-11-16)

Protocol 6 adds private messages and encrypted-key operations without changing
existing messages or fields. The exact additions and their shapes are recorded
in [engine-proposals.md](engine-proposals.md). New operations without an existing
control are listed in [interface-needs.md](interface-needs.md); no new visible
strings, CSS, layout or conversation/unlock view was invented.

- DM decisions live in core, with Worker effects for local, NIP-07 and NIP-46
  signers. NIP-17 text/group messages use NIP-44 seals and NIP-59 gift wraps;
  kind-10050 discovery routes a separate envelope to every recipient and self.
  Success requires acceptance for every envelope, not merely one relay reply.
  Conversation snapshots/read marks, release on hide/close and read-only older
  NIP-04 messages are implemented. Plaintext is isolated from public row/store
  caches and cleared on lock; delayed signer results cannot restore a revoked
  session. Backdated wraps retain a 48-hour overlap on reconnect. See [dm.md](dm.md).
- NIP-49 ncryptsec import/export and explicit session lock/unlock are implemented.
  Encrypted imports persist ciphertext only; session keys do not survive Worker
  restart. Account changes commit transactionally. Existing plaintext accounts
  remain usable until an explicit conversion. Claude's password/migration and
  DM interface specifications now take priority for the next implementation.
  See [keys.md](keys.md) for KDF bounds and limits.
- NIP-42 auth-required reads/writes use all three signers. A challenge alone
  causes no signature. Current demand, original publication owner, active read
  account and signer eligibility are rechecked on asynchronous completion.
  AUTH events never enter public history. Optional NIP-67 hints are not handled;
  see [relay-auth.md](relay-auth.md) for identity and lifetime guarantees.
- A failed or silent relay no longer vetoes healthy history forever. Paging
  waits for actual completion or the original deadline, advances only successful
  pages and preserves each failed route's cursor for recovery. Failure does not
  establish an empty history. Native regressions exceed 2000 healthy notes and
  exercise timeout/refusal/recovery alongside existing cursor/preemption cases.
- Real builds install a complete, hash-verified offline shell when CacheStorage
  and Web Locks are available. Failed updates and rollback preserve viable
  active/waiting shells; complete updates wait for every old client to close.
  Repeated waiting updates retain at most three shell caches. Interrupted
  activation cleanup recovers on the next controlled fetch. Events, keys and
  remote media never enter this cache. Loopback cases cover corrupt updates,
  rollback, update/activation races, offline assets/deep links and two tabs;
  see [offline-shell.md](offline-shell.md) and [hosting-needs.md](hosting-needs.md).

The separate `pnpm real:hour` command runs the real build with a fresh read-only
public account and fail-closed WebSocket publication guards. It remains outside
the default gate. Its baseline hour and fault phases are recorded separately;
loopback and mock checks do not substitute for public-network measurements.

## Corrections to the handoff and older status

Code wins over the handoff: pins have generic stored list data, but no dedicated
engine discovery/projection/edit operation yet. Unavailable bookmark IDs are
retained, but missing-note placeholder rows are not implemented. Person relay
URLs and stored reaction/repost actors exist; their detail views still need
Claude's design. These are not four equally complete engine surfaces.
Own-note deletion, hashtag timelines, uploads, bunker signing, public mutes,
bookmarks, lists, channels and rich note search already existed before this
stream. The visitor-relay-settings guard warning was stale: the existing control
already permits signed-out bootstrap changes. No replacement UI was needed.

## Reading and lists

Home/Global, another person's Home, replies/ancestors/descendants, grouped
notifications and read-watermark ties use verified stored events. Channel
messages remain separate from ordinary feeds. Search accepts all-word text,
phrases, exclusions, media/link filters, author unions and inward-rounded dates.
Date-only end boundaries follow local calendar days across daylight-saving time.
Profile views support posts/replies/reposts/reactions and media selections.

Following rows/counts share the newest valid distinct kind-3 p tags. Metadata
never removes or reorders a list member. People hydrate in bounded window
batches. Followers, thread descendants, bookmarks and joined channels page full
replies; settings collects finite pages beyond 500 before replacing a snapshot.
Muted windows refill themselves; only visible rows request references/counts.
Unavailable references distinguish a failed lookup from a completed absence.

Windows retain keys and reading anchors. Ordinary sides cap at 800 rows;
retainAbove caps at 6000. Time rails and ordinal seeks describe retained cache
membership, not the whole network. Generation snapshots reject changed queries.
Signed-out Global optionally filters repeated authors, duplicate bursts and
no-profile rows only after successful untruncated metadata lookups.

Notes display client tags, custom reactions, mentions, content warnings and
image/video/audio metadata. Kind-30023 publishing exists as Draft.longForm;
there is no parsed article document/reader. Note deletion checks authorship.
Per-note reaction/repost detail and profile editing await surfaces.

## Accounts, routing and publication

Create/import/use/remove and explicit raw backup are durable account actions;
read-only npub and external signers cannot return a local private key.
Secret-bearing Debug representations are redacted. Extension discovery and
signing correlate replies and validate the exact requested event. Preauthorized
bunkers use NIP-44 RPC, verified public keys and bounded closed sockets.

Every saved account refreshes profile/follow/relay/mute/server records without
an open account view. Verified NIP-65 usage wins, with retained indexer/hint
lookups and kind-3 JSON fallback. Search-only relay routes remain independent.
NIP-11 documents constrain filters, page limits and subscription counts.
SharedWorker and the Web Locks/BroadcastChannel fallback share visible wants;
hidden/detached views release work. Cache/store queues have explicit bounds.

Publishing plans author outboxes plus inbox/context routes, resolves ordinary
public actions on first acceptance and retains late per-relay confirmations.
Unanswered delivery remains unknown; retries have an aggregate 30-second budget.
Client tags default on and may be disabled. Persisted receipts help route later
deletes. Lists refuse an edit until initial lookup completion, preserve unknown
public tags and opaque private content, and reject unsupported private removals.

Blossom honors kind 10063; NIP-96 is the fallback. All signer kinds support upload
authorization. Required-response evidence, explicit server selection, bounded
processing and aggregate deadlines preserve truthful outcomes. Optional BUD-06
failure stays unknown. See [media-uploads.md](media-uploads.md).

## Mock answers not yet fully implemented

These are concrete runtime limits, not permission to fake a successful answer.

- Private people/bookmark/mute lists: local NIP-44 decryption works; NIP-07,
  bunker and historical NIP-04 list decryption remain incomplete. Public edits
  preserve ciphertext; encrypted private editing is unavailable.
- Emoji: own kind-10030 entries work; referenced kind-30030 sets are not fetched.
- Search: matching people are not placed ahead of notes; multi-language arrays
  use the first language. Bounded verified NIP-05 from-query lookup exists.
- Bunkers: auth_url challenges and relay-switch negotiation are unsupported.
- Uploads: intermediate transmitted-byte progress remains missing; zero and
  validated completion are reported, with bounded NIP-96 processing.
- Zaps: provider nostrPubkey discovery is not integrated. Current receipt-derived
  rows/totals are not trusted payment totals. LNURL zap signing/invoice flow,
  payment UI and a trusted zapper-detail query are absent.
- Device: physical IndexedDB size, cache clearing, settings archive import/export
  and encrypted cross-device setup sync are absent. Payload bytes are not disk size.
- Followed hashtags, parsed article documents, reports and complete NIP-11 detail
  projection remain missing. Full inventory and new protocol families: parity.md.

## Verification and shipping

Required gates are the root repo/native/WASM/verify commands and web check,
build and smoke. Protocol conformance adds DM, vault and AUTH cases to the real
Worker harness; native cases cover pure decisions and failure races. Public
measurements retain UTC date, host load, selected relays and limitations.
The first shipped tree passed all required gates and 287 real Worker checks.
Dates, load and concrete scope are in [engine-stream-verification.md](engine-stream-verification.md).

The owner's 2026-11-16 delegation authorizes rebased pushes and the prescribed
ship script. Tests use fresh ports and fixture data, clean their processes and
never publish to public relays or touch a saved owner account. The public hour
uses REQ/CLOSE only. Docker and unrelated host services remain untouched.

## One product

web/ is the only interface; lkjstr-engine-worker owns browser effects. The root
workspace is virtual; there is no Leptos/Trunk app. Deep technical history remains
in engine-package.md, owner-feedback.md, cover.md and verification.md.
