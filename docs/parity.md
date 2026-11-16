# Client parity

## Purpose

Source audit refreshed on 2026-11-16 against protocol 12 and account checkpoint `04c10b9b`; required integration gates passed.
The K1-K4/M1-M6 base passed its gates and is built. Protocol-9 required gates, 451 main Worker checks and 40 finite zap checks passed; exact source boundaries
and failures are recorded in [engine-zap-verification.md](engine-zap-verification.md).
Protocol-10 required gates, 452 main Worker checks and 31 private-list checks passed; see [engine-private-verification.md](engine-private-verification.md).
Current account production gates passed; see [engine-account-verification.md](engine-account-verification.md).
The last confirmed ship is 541e4a1e; the seventh ship failed at the host operation. Source status does not establish the deployed build.
Unregistered staging under tmp/ is excluded. This replaces the 11-14 inventory.
Rows describe lkjstr's real Worker and reachable interface, not mock capability.
`done` means implemented for the stated scope; it does not establish public-network
completeness. `partial` names a concrete limit. `engine ready, no surface` requires
an available engine operation or projection, not an isolated codec. `missing`
means no end-to-end engine operation; any reusable foundations are named.

The comparison set is Damus, Amethyst, Primal, Coracle, noStrudel and Snort.
It is a union of useful capabilities, not a claim that every client has every row.
Sources [A]-[C] identify additions to the older inventory; they are not a mandate
to implement every NIP. Public-network measurement is tracked separately in
[engine-performance.md](engine-performance.md). Run results remain in the referenced gate and measurement records.

Evidence prefixes: `E/` = `crates/lkjstr-core/src/engine/`,
`W/` = `crates/lkjstr-engine-worker/src/`,
`P/` = `crates/lkjstr-protocol/src/`, `N/` = `crates/lkjstr-nips/src/`,
`V/` = `web/src/views/`. Tests below are referenced evidence, not rerun by this document audit.

## Work order by daily impact

New written Claude specifications take priority when present.

1. Fix confirmed quote/noise hiding, then repeated count acquisition and
   concurrent pruning. Account persistence now has full production gate evidence.
2. Repeat the public hour after landing twelve with independent historical receipt
   budgets and observed execution suspension. Ninth network completeness and the
   sixth hour's seven Home candidates remain unresolved.
3. Add storage clearing and settings backup, then article documents, followed
   hashtags, reports and optional encrypted setup sync. Size estimates stay explicit.
4. Authorization, actor details, missing-bookmark placeholders, pins and person
   relay views await Claude's specifications. Upload phases/cancel work; actual
   intermediate bytes remain unavailable under the current transport guarantees.

## Reading, recovery and truth

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Home and public feed | done | Follow-list Home and signed-out filtered Global; E/query.rs, E/global.rs. |
| Read another person's Home | done | `their-home` with follow discovery and existing tile; E/rich.rs, V/their-home.ts. |
| Names, pictures and verified identities | done | Batched hydration and bounded NIP-05 HTTP verification; E/hydration.rs, W/worker_identity.rs, V/rows.ts. |
| Follow/unfollow, including a new account | done | First empty list requires completed owner lookup; E/settings.rs, E/commands.rs, V/rows.ts. |
| Following/follower lists | done | Distinct membership, metadata-independent rows and relay paging; E/wire/sources.rs, crates/lkjstr-core/tests/engine_list_integrity_test.rs. |
| Replies and nested thread navigation | done | Ancestors, focus, descendants and missing-reference states; E/thread.rs, V/feed.ts. |
| Grouped notifications and read state | done | Mentions/replies/reposts/reactions/zaps, filters and persistent timestamp ties; E/wire/notifications.rs, E/clients.rs. Zap trust is separate below. |
| Reading position and fresh-note indicator | done | Per-tab anchors, retained windows and Fresh; ninth network-cut IDs/offsets matched. Accepted page-freeze commands did not suspend observed execution; OS sleep remains untested. V/feed-place.ts, V/feed-fresh.ts, docs/engine-performance-ninth.md. |
| Calendar/time navigation | done | Cache-wide month counts and ordinal seeks; E/wire/timeline.rs, V/time-rail.ts. Not a count of all relay history. |
| Rich note search | done | Rich filters include every language-array alternative. Unavailable-repost fixes preserve note quota and Fresh; native, Worker and combined gates pass. E/wire/query_translate.rs, E/query_predicates.rs, docs/search.md, docs/unavailable-reposts.md. |
| People in search | partial | Six retained verified-metadata matches precede the exact note quota, with mute scope and stable anchors/Fresh. Native/Worker proof passes; remote people discovery remains absent. E/search_people.rs, E/wire/search.rs, docs/search.md. |
| Hashtag timelines | done | `hashtag` filter and linked tile exist; E/query.rs, V/registry.ts, V/note.ts. |
| Followed hashtags | missing | No kind-10015 discovery/edit or Home integration; list codecs alone do not supply it. |
| One-relay timeline | partial | `source:relay` targets requests, but cached membership is not relay-scoped and no feed tile is registered; E/network_plan.rs, E/query.rs, V/registry.ts. |
| Public-network completeness and hour-long use | partial | Ninth live interval completed 3600.108 s and 2009/2000 scroll IDs. Two valid quote rows were hidden by noise policy. Receipt caps prevent completeness; sixteen historical DOM positives have limited attribution. Sixth seven candidates remain unresolved. docs/engine-performance-ninth-coverage.md. |
| Shared Worker, two tabs and leader loss | done | SharedWorker continuity and fallback leader replacement were measured; 30-second/10-minute cuts include one delivered Home recovery witness. Later stale-callback and retained-history fixes have transport regressions; engine/transport.js, docs/engine-performance-hour.md. |
| Bounded cache and cold boot | partial | 16000 regular/4000 replaceable events in memory; newest 2000 indexed at boot, disk pruned to 20000 after live writes. Ninth WASM capacity reached 66846720 bytes; physical 20000-row boot reached a note in 328 ms. Concurrent pruning and indefinite growth remain under review. W/worker_persist.rs, docs/engine-performance-ninth.md. |
| Storage inspection and clearing | partial | Protocol12 separates memory payloads, exact stored-event row count (including ciphertext) and approximate origin usage; 14 native/19 Worker cases, client/mock/transport checks and merged gates pass. A surface, exact physical disk size and clear remain absent. docs/storage-inspection.md. |

## Identity, signers and private data

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Create/import a local key and explicit backup | done | Create, nsec import and explicit `account.key`; E/accounts.rs, V/account-add.ts, V/account-key.ts. |
| NIP-49 encrypted import/export | done | K1/K3 ciphertext sign-in and encrypted backup use the bounded codec; the real K13 flow verified exact download and same-key recovery. V/account-import.ts, V/account-key.ts, docs/keys.md; required integration gates passed. |
| Local keys encrypted at rest and session unlock | partial | K2/K4 unlock, lock, cross-page idle lock and explicit protection are reachable. Unlock is Worker-scoped: a sibling can keep a reload unlocked. Existing plaintext accounts convert only by explicit protection/import; strict per-page vault/cache leases are missing. docs/keys.md. |
| NIP-07 extension signing | done | Correlated public-key discovery, exact-event validation and deadlines; W/worker_sign.rs, web/src/engine/client.ts. Encryption/decryption is separate below. |
| NIP-46 bunker signing | partial | Pasted preauthorized bunker URI, durable session and verified signing work. Owner-bound auth_url passes native/52 Worker checks and merged gates; a surface remains pending; fallback followers/background relay AUTH remain unsupported, as does relay-switch negotiation. docs/bunker-auth.md. |
| QR/nostrconnect connection workflow | missing | Current input accepts bunker text; no connection-QR generation/scanning flow. |
| Read-only npub account | done | Imported public account cannot sign; E/accounts.rs, V/account-add.ts. |
| Multiple saved accounts and switch | done | Global active account, removal and per-account draft/outbox isolation; E/accounts.rs, V/compose-who.ts. |
| Durable account writes across Worker graphs | done | Strict same-database schema fence and revision comparison reject stale snapshots, preserving added/protected keys and atomic removal. Conflicts require explicit reload; no automatic reconciliation. Native, production and release evidence: docs/account-persistence.md, docs/engine-account-verification.md. |
| Independent per-tile posting identity | missing | Composer identity changes the globally active account; V/compose-who.ts. |
| Edit profile metadata | engine ready, no surface | `profile.save` carries name/about/picture/banner/NIP-05/website/lightning address; E/wire/actions.rs. No V/ control calls it. |
| Upload profile picture/banner | partial | Upload action and profile.save exist independently; no profile editor joins them. |
| Profile relay list | engine ready, no surface | `ProfileRow.relays` contains known outbox URLs; E/wire/sources.rs. V/rows.ts does not draw them. |
| Public mute people/words/tags/threads | done | Existing settings and note actions, with feed/notification hiding; E/settings.rs, V/settings-lists.ts, V/note-actions.ts. |
| Encrypted private list reading | done | Current signed mute/bookmark/people lists support local, extension and bunker NIP-44 and historical NIP-04 reads. External work requires visible opted-in ownership; cache/call bounds and unsupported methods remain explicit. Existing feeds/Mutes are wired; named-set navigation is separate. E/private_lists/, docs/private-lists.md. |
| Encrypted private list edits | missing | Public edits preserve ciphertext; removing private entries is refused. No encrypt/edit flow for any signer. |
| People/follow-set reading | engine ready, no surface | `open source:list` projects public members and owner-scoped private entries; hydration follows the same boundary. No list tile exists; E/wire/sources.rs, E/hydration.rs, docs/private-list-scope.md. |
| People-set creation/edit and feed subscription | missing | No list-edit action or dedicated saved-set feed workflow. |
| User status and external identity proofs | missing | NIP-38/39 have no runtime projection or action. |

## Messaging, relays and payments

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| NIP-17 DMs and gift wrapping | done | M1-M3 conversation/list/text composer surfaces use all three signers, NIP-44 seals and per-recipient/self wraps. Private models stay separate from public rows; E/dm/, W/worker_dm*.rs, V/messages.ts, V/message.ts, docs/frontend-dm.md. |
| DM inbox relay list and delivery | done | M4 edits/publishes kind 10050 and presents proved missing-inbox setup. Routing uses every recipient's and self's inbox; success requires each envelope, with actual partial outcomes. V/settings-dm.ts, E/dm/routing.rs, docs/frontend-dm.md. |
| DM history, unread and account mark | partial | M1/M2/M6 show conversations, durable Seen state and a body-free account count. Lists cap at 200, cached messages at 8000; saturated single-second history can stall and late older arrivals can fall below Seen. E/dm/, V/dm-window.ts, web/src/engine/dm-watch.ts. |
| External private-signer access | done | M5 consent, refusal, deadline and explicit Retry gate subscriptions/crypto; late replies cannot restore revoked access. web/src/engine/client-dm-access.ts, docs/dm-signers.md. |
| Encrypted local private drafts and failed sends | done | Protocol 8 archives up to 32 tabs/account and 32 retained rows/tab, 256 KiB/tab and 2 MiB/catalog; no eviction or automatic retry. All signers, revision guards and before-lock page flushing are implemented; docs/dm-drafts.md, docs/dm-editor-locks.md. Older protocols retain memory-only drafts. |
| Private files, reactions and message deletion | missing | URLs stay links; no private attachment, reaction or delete action. Group subjects display when received, but subject/member editing and read-receipt/sync controls are absent; docs/interface-dm.md. |
| Read old NIP-04 messages | done | M2 renders older messages decrypted by local, extension or bunker signers; no NIP-04 write API. W/worker_dm_receive.rs, V/dm-message-row.ts. |
| Public channels | done | NIP-28 discovery, metadata, join, send and unread marks; E/channels.rs, E/channel_actions.rs, V/channels.ts. |
| Public-channel moderator actions | missing | No kind-43/44 hide/mute action; ordinary personal mutes are distinct. |
| NIP-29 relay groups | missing | P/groups.rs has codecs; no engine membership/moderation or group view. |
| Read/write relay settings and NIP-65 | done | Verified list adoption, fallback and signed editing; E/discovery.rs, W/worker_relays.rs, V/settings-relays.ts. Visitor bootstrap edits also work. |
| NIP-11 scheduling limits | done | HTTP document fetch feeds subscription/filter/page limits; W/worker_relay_info.rs, E/network_limits.rs. |
| NIP-11 relay information surface | partial | Engine consumes limits but does not retain/project the complete information document; no detail view. |
| NIP-42 relay authentication | done | Explicit auth-required reads/writes use all signer kinds with current demand/owner checks. Optional NIP-67 EOSE hints remain unsupported; docs/relay-auth.md. |
| Relay health, request and delivery diagnostics | done | Real counters, errors, request purposes and attempted publication routes; E/feedback.rs, V/relays.ts, V/stats.ts. |
| Zap receipt display and totals | partial | Provider-authorized, signed and globally deduplicated receipts supply exact amounts, existing lower-bound counts and notification actors. Unresolved evidence stays separate; historical provider authorization is session-only and is not independent payment proof. E/zaps/, E/wire/counts.rs, docs/zaps.md. |
| LNURL discovery, zap signing and invoice retrieval | engine ready, no surface | Finite zap.quote and explicit zap.invoice use local/extension/bunker signers, bounded HTTPS and exact invoice commitments, returning only unpaid intents. Forty guarded Worker checks and the required integration gates passed; the existing zap control stays unavailable. W/worker_zap*.rs, docs/zaps.md. |
| WebLN, invoice payment/QR and NWC | missing | No payment contract or provider integration; V/note-actions.ts. NIP-47 is a separate missing wallet capability. |
| Per-note reactors and reposters | partial | Verified stored events retain authors; repost rows expose bounded actors and reaction rows expose counts. A complete actor-detail query and its specified view are missing; E/rows.rs, web/src/engine/protocol.ts. |
| Trusted zapper list | engine ready, no surface | zap.receipts returns at most 200 provider-authorized rows with exact millisatoshis, public/anonymous/private sender distinction and provenance. Its cursor traverses retained verified cache, not complete relay history; E/zaps/receipt_list.rs, docs/interface-needs.md. |
| Reliable publication feedback and retry | done | Early success, bounded retries, late confirmations and retained composer drafts; E/network_delivery.rs, V/compose-outbox.ts. |

## Composition, saved material and content kinds

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Notes, replies, reposts and quotes | done | Read and publish through all existing signer types; E/wire/publish.rs, V/note-actions.ts, V/compose.ts. |
| Unicode/custom reaction picker | partial | Direct entries and up to 32 owner-selected kind-30030 sets project at most 400 codes with finite discovery. Twenty native and eleven Worker cases, strict Clippy and combined conformance pass. Encrypted sets and per-set retry are unsupported. E/emoji.rs, V/emoji-picker.ts, docs/emoji-sets.md. |
| Selected mentions and custom emoji in text | done | Engine expands selected ranges and preserves emoji tags; E/wire/mentions.rs, V/compose-mentions.ts. |
| Image/video/audio upload | partial | Blossom and NIP-96 discovery, every signer and retries work; cancellation and phases work; fetch cannot expose intermediate transmitted bytes while preserving redirect rejection and bounded responses; W/worker_upload*.rs, V/compose-media.ts. |
| Media rendering and metadata | done | Notes render image/video/audio, dimensions, alt text and playback state; E/row_media.rs, V/note-media.ts, V/note-audio.ts. Dedicated media event kinds are separate below. |
| Content warnings | done | Engine projection, covered media and composer warning; P/nip36.rs, V/note.ts, V/compose.ts. |
| Public bookmarks | done | Add/remove, list membership and fetched-note paging; E/list_events.rs, V/note-actions.ts, V/registry.ts. |
| Unavailable bookmark placeholders | partial | IDs persist and fetch; projection skips missing target events. No placeholder Row variant; E/wire/sources.rs. |
| Pinned notes | partial | Generic kind-10001/list storage exists; no dedicated discovery/projection/edit action. This is less than a completed engine operation. |
| Publish long-form articles | engine ready, no surface | `Draft.longForm` emits kind 30023; E/wire/publish.rs. No composer control sends it. |
| Read long-form articles | missing | No parsed document row or article reader; ordinary feeds request kinds 1/6. |
| Delete own notes/reactions/reposts | done | Existing menu and author check create kind 5; E/wire/publish.rs, E/commands.rs, V/note-actions.ts. |
| Undo social actions | done | Delayed like/repost, inverse bookmark/mute actions; V/held.ts, V/note-actions.ts. Remote deletion cannot promise erasure. |
| Report events/people | missing | No kind-1984 action or reporting view. |
| Raw event inspection/export | missing | Store contains signed events but no explicit inspector/export operation. |
| Public links and URI navigation | partial | Note/profile links, identifiers and hashtag clicks work; article routes and generic handlers do not; web/src/shared/address.ts, V/registry.ts. |
| Optional link preview cards | partial | Engine and drawing exist, but same-origin optional preview service is absent on static hosting; W/worker_preview.rs, V/link-cards.ts. |
| Cross-device draft sync | missing | Local drafts persist immediately; no NIP-37 encrypted draft publication/restoration. |

## Other current client capabilities omitted by the old table

These rows come from the current capability lists [A]-[C]. Their absence is an
inventory finding, not permission to add unplanned interface surfaces.

| Capability | Status | Concrete scope or missing operation |
| --- | --- | --- |
| General comments (NIP-22) | missing | No kind-1111 thread/comment projection; current threads use kinds 1/42. |
| Picture and short-video events (68/71) | missing | Inline files work; kinds 20/21/22 lack feed projection and authoring. |
| Polls (88) | missing | No poll/vote actions or aggregate projection. Polls are not NIP-69. |
| Live streams, spaces and live chat (53) | missing | No live-activity discovery/session/chat model. |
| Voice-message events and recording (A0) | missing | Audio files play; no voice-event or capture workflow. |
| Calendar events and classifieds (52/99) | missing | No domain projections/actions. |
| Community, forum and chat formats (72/7D/C7) | missing | Current channels implement NIP-28 only. |
| Badges, highlights and user labels (58/84/32) | missing | No reader-facing projections/actions. |
| Web bookmarks, code snippets and podcasts (B0/C0/F4) | missing | No typed content projections; ordinary URL/audio support is narrower. |
| App handlers and recommendations (89) | partial | Optional client tag is emitted; handler discovery/opening is absent. |
| Graph-based moderation and recommendations | partial | Graph weights affect relay planning, not a trust-controlled media policy or recommendation feed; E/weights.rs. |
| Negentropy and completeness hints (77/67) | missing | No NEG-* reconciliation or EOSE completeness-hint policy. |
| Background push notifications | missing | The service worker caches the application shell; it has no push subscription or background message/notification delivery. Foreground feeds and the opt-in private unread watch are separate. web/scripts/shell-cache.ts. |
| In-app translation | missing | Interface localization exists; note translation does not. |
| User-event archive import/export | missing | No user-accessible archive action. |

## Workspace and device

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Independent duplicate tabs, tiling and nine workspaces | done | Persistent layout, tab-specific state, drag/split/close/undo; web/src/wm/, web/tests/undo.test.ts. |
| Keyboard navigation and tab search | done | Documented shortcuts and cross-workspace search; web/src/shared/keys.ts, web/src/wm/tab-search.ts. |
| Responsive tiles and appearance controls | done | Existing tile layout, scale/theme and reader settings; web/src/wm/, web/src/shared/settings.ts. |
| Japanese interface | partial | Paired string tables and guards exist; external provider errors may remain in their original language. |
| Settings file export/import | missing | No settings archive, validation or restore action. |
| Installable offline shell and coherent updates | done | Real-build SHA-256 asset cache with CacheStorage/Web Locks, failed-update rollback and activation after old clients close; at most three caches across waiting updates. Loopback verified; the public-hour guard excludes service workers. web/scripts/shell-cache.ts, docs/offline-shell.md. |
| Encrypted optional setup sync (78/44) | missing | Local same-origin UI storage is not encrypted cross-device sync. |

## Audit corrections and sources

The older table incorrectly called bunker signing, follow-list creation,
NIP-05 verification, uploads, public mutes/bookmarks, quotes, hashtag reading,
own-event deletion, grouped notifications and social Undo missing or narrower.
The first audit's missing relay AUTH is now implemented; pins still lack dedicated
operations. Visitor bootstrap relay editing already existed. The newer engine
stream supplied the offline service worker, and Claude's specs supplied the K/M
surfaces; older no-surface/no-public-hour prose is no longer a current finding.

The full 2026-11-16 screenshot matrix covered all 39 K/M states in 12 variants
(468 required captures); review sheets are under tmp/screens-interface-20261116-matrix.
Fresh loopback real UI runs passed K13 at 10:32:12 UTC (6.576 s, starting load
7.92/7.87/6.35) and M16 at 10:57:49 UTC (11.561 s, load 6.33/3.44/3.65).
Evidence: docs/keys.md, docs/frontend-dm.md and their raw report paths. Required
gates and specification closure are recorded in docs/interface-verification.md.
These runs do not measure public DM delivery, real providers or this build for an hour.
Public controls also exclude grouped notification constituents and deeper
untagged thread replies; recovery witnesses are not universal completeness.

- [A] [Amethyst supported features](https://github.com/vitorpamplona/amethyst#supported-features), checked 2026-11-16.
- [B] [Coracle features](https://github.com/coracle-social/coracle#features), checked 2026-11-16.
- [C] [Nostr specifications](https://github.com/nostr-protocol/nips), checked 2026-11-16; distinguishes current identifiers from historical client labels.
