# Status

## Purpose

Current engine behavior and concrete limits. The source audit is [parity.md](parity.md); network measurements are in
[engine-performance.md](engine-performance.md). Interface work belongs to Claude.

## Specified keys and messages (2026-11-16)

Protocol 8 implements Claude's K1-K4, M1-M6 and D1 specifications with the
existing paired strings and design tokens. Conversation lists, older private
messages, one-to-one/group text, inbox settings and encrypted draft/failed-send
recovery are reachable. Private bodies never enter public row caches or ordinary
layout storage. Lock coordinates registered editors across clients before
revoking plaintext; an unresponsive or expired unresolved editor prevents lock.
The durable archive, signer and editor bounds are documented in
[dm-drafts.md](dm-drafts.md), [dm-signers.md](dm-signers.md) and
[dm-editor-locks.md](dm-editor-locks.md). No group-subject/file/reaction/delete
surface was added. Strict per-page unlocking remains a recorded K2 difference.

The 468 required width/theme/language captures were generated and reviewed.
Fresh real-Worker UI checks passed 13 key and 16 message assertions, including
stable inbox discovery across relay-slot rotation. All seven required gates
passed; evidence and limits are in [interface-verification.md](interface-verification.md).
Persisted browser-history pages now keep their editor lease and probe the
connection on resume; deterministic transport events cover live/expired Workers.
Completed empty inbox evidence survives relay-slot rotation. Explicit stop
revokes private rows, key/startup queues and projections, and closes all entry paths.

## Follow-up lifetime fixes (2026-11-16)

Protocol 7 adds atomic private-view visibility and acknowledged upload
cancellation. Attachment removal, clear and disposal cancel queued authorization,
HTTP response/body waits and processing polls. Late replies cannot settle a
replacement job. Intermediate transmitted bytes remain unavailable; cancellation
does not delete a remote blob already accepted.

Successful lock/remove synchronously prunes decrypted private-list policy and
derived rows, including hidden views, before acknowledgement. Previously old
policy survived until the next status pass. Revoked private anchors are rejected
on replay; failed account transactions preserve authorized state. External
private-list decryption remains missing.

Recovering relays retain their missing span without displacing healthy live
fallbacks. History waits for verification; queue loss revokes completion and
retries the unchanged span with bounded backoff. See
[engine-verification-pressure.md](engine-verification-pressure.md).
Indexed retained-row diffs acquire and store all 5,000 loopback notes.
Thread ancestors precede the focus despite timestamp ties or clock skew.
The preceding landing passed required gates and 338 real Worker checks;
[engine-lifetime-verification.md](engine-lifetime-verification.md) records limits.

## Engine stream (2026-11-16)

Protocol 6 introduced DM, encrypted-key and relay authentication operations.
Protocols 7/8 are additive; exact shapes are in
[engine-proposals.md](engine-proposals.md). Unreached operations remain in
[interface-needs.md](interface-needs.md).

- Core/Worker DM supports local, NIP-07 and NIP-46 signers. NIP-17 text/group
  messages use NIP-44 seals and NIP-59 wrappers sent to each participant and self.
  Success needs every envelope accepted. Conversation/read marks, history,
  hidden-view release and read-only NIP-04 are implemented. Private bodies stay
  out of public caches; lock/replacement revoke them. Reconnect overlaps
  backdated wraps by 48 hours. See [dm.md](dm.md).
- NIP-49 import/export and explicit lock/unlock commit accounts transactionally.
  Encrypted imports persist ciphertext only; session keys do not survive Worker
  restart. Existing plaintext accounts remain usable until explicit protection.
  K1-K4 supply verified password/import/unlock/backup/migration controls.
  Unlock is Worker-scoped; strict per-page permission needs
  a vault/cache lease, not a visual flag. See [keys.md](keys.md).
- NIP-42 auth-required reads/writes use all signers. A challenge alone causes no
  signature. Demand, original owner and authority are checked on asynchronous
  completion. AUTH never enters public history. Optional NIP-67 hints remain
  unsupported; see [relay-auth.md](relay-auth.md).
- Failed/silent relays do not veto healthy history forever. Paging waits for
  completion or the original deadline, advances successful pages and preserves
  failed-route cursors. Failure never establishes empty history.
- Real builds install a complete hash-verified offline shell with CacheStorage
  and Web Locks. Failed updates/rollback preserve usable shells; activation waits
  for old clients to close. At most three shell caches remain, and interrupted
  cleanup recovers on fetch. Events, keys and remote media are excluded.
  Loopback cases cover corruption, rollback, offline links and two-tab races;
  see [offline-shell.md](offline-shell.md).

The separate `pnpm real:hour` uses fresh read-only public-account data and
fail-closed publication guards. Its dated baseline hour and fault phases are
recorded independently; mock/loopback checks do not replace network measurements.

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

- Private lists: local NIP-44 works; external signers and historical NIP-04
  remain incomplete. Named-list queries can merge another saved account's
  private tags; no named-list surface exists. Public edits preserve ciphertext;
  encrypted private editing is unavailable.
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
Current UI evidence, including 34 focused key tests, the 468-state matrix and
fresh real key/message flows, is in [interface-verification.md](interface-verification.md).
The specification index marks these items built, with the recorded K2 differences.

The owner's 2026-11-16 delegation authorizes rebased pushes and the prescribed
ship script. Tests use fresh ports and fixture data, clean their processes and
never publish to public relays or touch a saved owner account. The public hour
uses REQ/CLOSE only. Docker and unrelated host services remain untouched.

## One product

web/ is the only interface; lkjstr-engine-worker owns browser effects. The root
workspace is virtual; there is no Leptos/Trunk app. Deep technical history remains
in engine-package.md, owner-feedback.md, cover.md and verification.md.
