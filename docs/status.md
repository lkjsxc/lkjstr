# Status

## Purpose

Current limits: [parity.md](parity.md), [engine-performance.md](engine-performance.md). [Public deep links](public-deep-links.md) work signed out.
Claude owns the interface. Account-safe and A1/A2 (972ef776) are live;
[Q1](engine-q1-progress.md) passes matched public scoring; Worker and ship gates remain. Q2-Q5 remain.

## Kind capabilities (private implementation, 2026-11-22)

N1 centralizes kind policy and public ID/address access. Rows and quotes carry their kind; existing feeds and counts stay unchanged.
Private and ephemeral events stay out. Other kinds have no actions; richer faces and tabs remain in [interface-view.md](interface-view.md).

## Specified keys and messages (2026-11-16)

Protocol 8 implements Claude's K1-K4, M1-M6 and D1 specifications with the existing paired strings and design tokens. Conversation lists, older
private messages, one-to-one/group text, inbox settings and encrypted draft/failed-send recovery are reachable. Private bodies never enter public row
caches or ordinary layout storage. Lock coordinates registered editors across clients before revoking plaintext; an unresponsive or expired unresolved
editor prevents lock. The durable archive, signer and editor bounds are documented in [dm-drafts.md](dm-drafts.md), [dm-signers.md](dm-signers.md) and
[dm-editor-locks.md](dm-editor-locks.md). No group-subject/file/reaction/delete surface was added. Strict per-page unlocking remains a recorded K2 difference.

The 468 required width/theme/language captures were generated and reviewed. Fresh real-Worker UI checks passed 13 key and 16 message assertions,
including stable inbox discovery across relay-slot rotation. All seven required gates passed; evidence and limits are in
[interface-verification.md](interface-verification.md). Persisted browser-history pages now keep their editor lease and probe the connection on
resume; deterministic transport events cover live/expired Workers. Completed empty inbox evidence survives relay-slot rotation. Explicit stop revokes
private rows, key/startup queues and projections, and closes all entry paths.

## Follow-up lifetime fixes (2026-11-16)

Protocol 7 adds atomic private-view visibility and acknowledged upload cancellation. Attachment removal, clear and disposal cancel queued
authorization, HTTP response/body waits and processing polls. Late replies cannot settle a replacement job. Intermediate transmitted bytes remain
unavailable under fetch's redirect-rejection/body-limit guarantees; XHR would weaken them. Cancellation does not delete an accepted remote blob.

Successful lock/remove synchronously prunes decrypted private-list policy and derived rows, including hidden views, before acknowledgement. Previously
old policy survived until the next status pass. Revoked private anchors are rejected on replay; failed account transactions preserve authorized state.
The subsequent private-list read support is described below.

Full historical predecessors now retain their ordinary route slot at an inclusive cursor, preventing false exhaustion after quality reranking.
Native and production Worker before/after, merged required gates and loopback conformance passed. See [engine-history-route.md](engine-history-route.md).

Recovering relays retain their missing span without displacing healthy live fallbacks. History waits for verification; queue loss revokes completion
and retries the unchanged span with bounded backoff. See [engine-verification-pressure.md](engine-verification-pressure.md). Indexed retained-row
diffs acquire and store all 5,000 loopback notes. Thread ancestors precede the focus despite timestamp ties or clock skew. The preceding landing
passed required gates and 338 real Worker checks; [engine-lifetime-verification.md](engine-lifetime-verification.md) records limits.

## Engine stream (2026-11-16)

Protocol 6 introduced DM, encrypted-key and relay authentication operations. Protocols 7/8/9/10/11/12/13 are additive; exact shapes are in
[engine-proposals.md](engine-proposals.md). Unreached operations remain in [interface-needs.md](interface-needs.md).

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
- Current signed mute, bookmark and people lists decrypt locally or through
  extensions/bunkers using NIP-44 or historical read-only NIP-04. Visible external
  reads have owner-scoped leases; local mute policy also qualifies background
  unread counts. Private editing and list-specific Retry controls remain absent;
  see [private-lists.md](private-lists.md).
- NIP-57 providers authorize receipt actors/totals and finite zapper queries.
  Explicit local/extension/bunker invoice requests are HTTPS-only and return
  unpaid intents; no payment control exists. Bounds/evidence: [zaps.md](zaps.md).
- Failed/silent relays do not veto healthy history forever. Paging waits for
  completion or the original deadline, advances successful pages and preserves
  failed-route cursors. Failure never establishes empty history.
- Real builds install a complete hash-verified offline shell with CacheStorage
  and Web Locks. A verified update can take over the next reload while an
  open draft gets a notice. The previous hashed assets remain during handoff,
  and interrupted cleanup recovers on fetch. Events, keys and media are excluded.
  Loopback cases cover corruption, rollback, offline links and two-tab races;
  see [offline-shell.md](offline-shell.md).

The separate `pnpm real:hour` uses fresh read-only public-account data and fail-closed publication guards. Its dated baseline hour and fault phases
are recorded independently; mock/loopback checks do not replace network measurements. Host evidence now copies capture-time targets, query endings
and receipt metadata; the frozen sixth record retains its earlier mutable-counter limitation.
See [engine-performance-evidence.md](engine-performance-evidence.md).

Signed-out notifications retain the core done state; later zap receipt-evidence changes preserve the last observed relay phase and counters. The
initial rows no longer synthesize a cache phase before the network supplies its real state.

A repeated Open starts a new status observation while retaining shared relay requests and cursors. Old queued status cannot seed the new query;
private completion reuses only its current observed relay state. Native before/after cases and the rebuilt private-list Worker proof cover the
reproduced Retry/reopen hang; see [engine-private-verification.md](engine-private-verification.md).

The protocol-9 candidate reproduced aborted WASM response bodies during parallel startup. Removing its document-level WASM preload preserves the
Worker assets and verified offline shell; [engine-startup.md](engine-startup.md) records the controlled before/after proof. The earlier 541e4a1e
comparison passed.

## Corrections to the handoff and older status

Code wins over the handoff: pins have generic stored list data, but no dedicated engine discovery/projection/edit operation yet. Unavailable bookmark
IDs are retained, but missing-note placeholder rows are not implemented. Person relay URLs and stored reaction/repost actors exist; their detail views
still need Claude's design. These are not four equally complete engine surfaces. Own-note deletion, hashtag timelines, uploads, bunker signing, public
mutes, bookmarks, lists, channels and rich note search already existed before this stream. The visitor-relay-settings guard warning was stale: the
existing control already permits signed-out bootstrap changes. No replacement UI was needed.

The design document says 800 retained rows; code permits 6000 through retainAbove. The public scroll measurements exercised this larger retained DOM.
The 800-row moving request remains distinct; Claude's design file was left unchanged. Note fitting batches stable time-rail/native widths; uncertain
native-scrollbar cases keep sequential decisions. Separate 2000-note draws fell from 4002 layouts to four with identical DOM and row heights;
[frontend-layout.md](frontend-layout.md) separates these finite workloads from the public scroll delays that motivated them.

## Reading and lists

Home/Global, another person's Home, replies/ancestors/descendants, grouped notifications and read-watermark ties use verified stored events. Channel
messages remain separate from ordinary feeds. Search accepts all-word text, phrases, exclusions, media/link filters, author unions,
language-array OR and inward-rounded dates. Date-only end boundaries follow local calendar days across daylight-saving time. Six retained
verified-directory people precede note windows without shifting budgets, anchors, Fresh or time counts. Eleven native and seven Worker checks pass;
remote people discovery remains absent. Profile views retain posts/replies/reposts/reactions and media selections. See [search.md](search.md).

Following rows/counts share the newest valid distinct kind-3 p tags. Metadata never removes or reorders a list member. People hydrate in bounded
window batches. Followers, thread descendants, bookmarks and joined channels page full replies; settings collects finite pages beyond 500 before
replacing a snapshot. Muted windows refill themselves; only visible rows request references/counts. Unavailable references distinguish a failed lookup
from a completed absence. Named-list queries and profile hydration include cached private members only when the query names the signed list owner;
other readers keep public tags. The reproduced isolation fix is documented in [private-list-scope.md](private-list-scope.md).

Window sides cap at 800 rows; retainAbove caps at 6000. Returning to the newest rows retains the loaded tail within the 6800-row bound.
Older pages start two and a half pane heights from the end with a 60-row buffer. See [live-feed.md](live-feed.md). Time rails use retained cache.
Visitor Global covers repeats and author bursts. Missing profile metadata never excludes a valid post. See [note visibility](hidden-note-visibility.md).
[Absolute windows](absolute-time-window.md) provide bounded relay coverage on both sides for Their Home and keep covered reposts at their verified reading time.
Notes project client names and valid NIP-89 handler coordinates. Explicit presses resolve verified app metadata; signing honors the account preference.
Custom reactions, mentions, warnings and media remain in note rows. See [client attribution](client-attribution.md).
Notes, reactions, names and bios use signed emoji tags. The picker preserves set coordinates in note and reaction tags. See [emoji-sets.md](emoji-sets.md).
`Draft.longForm` publishes kind 30023. Article reading, profile editing and per-note reaction/repost detail await surfaces. Deletion checks authorship.
## Accounts, routing and publication
Account writes compare durable revisions; strict boot and schema fencing preserve rows across Worker graphs. Protocol13 separately reports account-load
failure, retains client accounts and uses existing feed error wording. [Completed production proof](engine-availability-verification.md).
Read-only/external accounts cannot export local keys; Debug redacts secrets. Extension/bunker signing remains owner-bound and verified.

Every saved account refreshes profile/follow/relay/mute/server records without an open account view. Verified NIP-65 usage wins, with retained
indexer/hint lookups and kind-3 JSON fallback. Search-only relay routes remain independent. NIP-11 documents constrain filters, page limits and
subscription counts. SharedWorker and Web Locks/BroadcastChannel share visible wants; hidden/detached views release bounded cache and relay work.
[Relay orchestration](relay-orchestration-20261119.md) adds progressive reads, gap repair, NIP-65 routes and a ten-second startup soft bound.

Public notes use bounded write waves and resolve on the first matching positive OK. See [orchestration.md](orchestration.md).
Signed text notes appear in Home, Profile and Thread before any relay reply. Cached write lists and connected write-enabled relays send while discovery runs.
Note destinations get ten seconds to connect and five seconds after the first frame; late confirmations remain available. Passive inbox checks yield to writing.
Persisted receipts help route deletes. Lists wait for initial lookup, retain opaque content and reject unsupported private removals.
Public wire patches retain rows that only moved. Signed reactions share the next planning pass. [Signing measurements](signing-latency.md).

Blossom honors kind 10063; NIP-96 is the fallback. All signer kinds support upload authorization. Required-response evidence, explicit server
selection, bounded processing and aggregate deadlines preserve truthful outcomes. Optional BUD-06 failure stays unknown. See
[media-uploads.md](media-uploads.md).

## Mock answers not yet fully implemented

These are concrete runtime limits, not permission to fake a successful answer.

- Private lists: supported local/extension/bunker reads cover NIP-44 and older
  NIP-04. Public edits preserve ciphertext; private editing, named-set navigation
  and list-specific Retry controls remain absent. Rows/hydration are owner-scoped.
- Search: retained people, language OR and unavailable repost quotas/Fresh pass
  native/Worker proof and combined gates. Remote people discovery remains absent.
  See [unavailable-reposts.md](unavailable-reposts.md).
- Bunkers: auth_url passes native/52 Worker checks and combined gates, without controls; see [bunker-auth.md](bunker-auth.md). Relay switching is unsupported.
  Without a registered authorization presenter, the current client returns unsupported promptly; no new surface exists.
- Uploads: phases, zero/validated completion and cancellation work; actual byte
  progress is unavailable without weakening redirect/body limits. NIP-96 processing remains bounded.
- Device: protocol12 inspection distinguishes memory payload bytes, all event-store records (including ciphertext), and approximate origin usage.
  Focused 14 native/19 Worker checks, strict Clippy and full merged gates pass; a surface remains pending.
  Exact disk bytes, clearing, settings archives and setup sync remain absent; [storage-inspection.md](storage-inspection.md).
- Followed hashtags, parsed article documents, reports and complete NIP-11 detail
  projection remain missing. Full inventory and new protocol families: parity.md.

## Verification and shipping

Required gates are the root repo/native/WASM/verify commands and web check, build and smoke. Protocol conformance adds DM, vault and AUTH cases to the
real Worker harness; native cases cover pure decisions and failure races. Public measurements retain UTC date, host load, selected relays and
limitations. Earlier `541e4a1e` passed all required gates and 545 real interface checks. [interface-verification.md](interface-verification.md)
records dates, load, the 468-state matrix and K2 differences. The completed third public hour has a [scoped audit](engine-performance-third.md); the
private-list scope follow-up has separate evidence. Protocol 9 and its startup/distribution corrections passed all required gates;
[engine-zap-verification.md](engine-zap-verification.md) records the runtime and measurement evidence. Protocol-10 private-list and layout integration
passed all required gates, 452 main Worker checks and 31 private-list checks; the dated record is
[engine-private-verification.md](engine-private-verification.md). The [sixth public hour](engine-performance-sixth.md) and faults are complete: 1903
of 2000 requested notes and seven unresolved Home coverage candidates. Productive-route recovery and verification-queue guards pass native and
production Worker before/after proof and combined gates. Public availability is still unknown; see [engine-live-route.md](engine-live-route.md).
The sixth prescribed ship stopped before deployment at 16:35:57 UTC: separate package validators still required a direct HTML WASM preload.
The archive graph and numeric-token corrections pass 80 package cases and 19 xtask tests; all required combined gates and exact packaging passed.
The seventh ship's stale host validator was corrected through GitOps.
Account-safe 07e88178 shipped at 02:07 UTC with schema-2 rollback and HTTPS proof;
A1/A2 shipped at 972ef776. [Receipts and hashes](engine-shipping.md).
Q1: 894 -> 567 requests; 100/100 witnesses. Worker 543/549, mock, upload and offline gates pass; ship pending. [Score](q1-public-score-20261117.md).

Protocol-11/12 gate records: [variants](engine-variants-verification.md), [device](engine-device-verification.md).
The [ninth hour](engine-performance-ninth.md) and [coverage audit](engine-performance-ninth-coverage.md) record hidden quotes and evidence limits.

The owner's 2026-11-16 delegation authorizes rebased pushes and the prescribed ship script. Tests use fresh ports and fixture data, clean their
processes and never publish to public relays or touch a saved owner account. The public hour uses REQ/CLOSE only. Docker and unrelated host services
remain untouched.
