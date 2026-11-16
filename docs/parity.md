# Client parity

## Purpose

Source audit of `6830584c` plus the 2026-11-16 engine stream. This replaces
the 11-14 inventory; gate/run evidence is in status.md and engine-performance.md.
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
`V/` = `web/src/views/`. Tests below are existing coverage, not rerun by this audit.

## Work order by daily impact

1. Measure the real build: missed Home/notification/thread notes, late names,
   paging, idle growth, offline recovery, leader loss and 20000-event boot.
   Reproduced loss, freezes and incorrect success states take precedence.
2. Restore unavailable data paths: relay AUTH for all signers, private-list
   decryption, then remove misleading zap totals through provider validation.
3. Key protection/import/export and complete DM delivery, including inbox
   discovery, unread state, every signer and old-message reading.
4. Finish existing controls: referenced emoji sets, search people/languages,
   bunker authorization challenges, upload cancellation/progress.
5. Add offline/update safety, measured cache management and settings backup;
   then articles, followed hashtags, reports and other new protocol families.
6. Request Claude's surfaces for ready operations; implement pending written
   interface specifications before feature work. Revisit this order after each
   measured run. No unfinished `docs/interface-specs.md` existed at audit start.

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
| Reading position and fresh-note indicator | done | Per-tab anchors, retained windows, new-row counts and hydration restoration; V/feed-place.ts, V/feed-fresh.ts. Public sleep/wake is unmeasured. |
| Calendar/time navigation | done | Cache-wide month counts and ordinal seeks; E/wire/timeline.rs, V/time-rail.ts. Not a count of all relay history. |
| Rich note search | partial | Text/phrases/exclusions/media/author/date filters work; language arrays use only their first entry; E/wire/query_translate.rs, E/rich.rs. |
| People in search | partial | `people` directory and verified NIP-05 lookup exist; ordinary search does not prepend matching people; E/wire/people.rs, E/identities.rs. |
| Hashtag timelines | done | `hashtag` filter and linked tile exist; E/query.rs, V/registry.ts, V/note.ts. |
| Followed hashtags | missing | No kind-10015 discovery/edit or Home integration; list codecs alone do not supply it. |
| One-relay timeline | partial | `source:relay` targets requests, but cached membership is not relay-scoped and no feed tile is registered; E/network_plan.rs, E/query.rs, V/registry.ts. |
| Public-network completeness and hour-long use | partial | Loopback coverage exists; no controlled hour-long public comparison in this snapshot; scripts/engine-harness.mjs. |
| Shared Worker, two tabs and leader loss | done | SharedWorker plus Web Locks/BroadcastChannel fallback; engine/transport.js and existing harness. Real sleep/wake and public recovery remain unmeasured. |
| Bounded cache and cold boot | partial | 16000 regular/4000 replaceable in memory; newest 2000 indexed on boot, disk pruned to 20000 after live writes. No real 20000-event boot/recovery sample yet; W/worker_persist.rs. |
| Physical cache size and clearing | missing | Stats `cacheBytes` is stored payload bytes, not actual IndexedDB usage; no clear-cache operation; E/feedback.rs. |

## Identity, signers and private data

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Create/import a local key and explicit backup | done | Create, nsec import and explicit `account.key`; E/accounts.rs, V/account-add.ts, V/account-key.ts. |
| NIP-49 encrypted import/export | engine ready, no surface | Explicit ciphertext import/export, bounded KDF and native/browser cases; E/accounts_vault.rs, W/worker_keys.rs, docs/keys.md. |
| Local keys encrypted at rest and session unlock | partial | Encrypted imports persist ciphertext and unlock only for the Worker session. Existing plaintext accounts need the specified migration/unlock UI; docs/keys.md. |
| NIP-07 extension signing | done | Correlated public-key discovery, exact-event validation and deadlines; W/worker_sign.rs, web/src/engine/client.ts. Encryption/decryption is separate below. |
| NIP-46 bunker signing | partial | Pasted preauthorized bunker URI, durable session and verified signing work; auth_url challenges and relay-switch negotiation do not; V/account-add.ts, W/browser/remote.rs. |
| QR/nostrconnect connection workflow | missing | Current input accepts bunker text; no connection-QR generation/scanning flow. |
| Read-only npub account | done | Imported public account cannot sign; E/accounts.rs, V/account-add.ts. |
| Multiple saved accounts and switch | done | Global active account, removal and per-account draft/outbox isolation; E/accounts.rs, V/compose-who.ts. |
| Independent per-tile posting identity | missing | Composer identity changes the globally active account; V/compose-who.ts. |
| Edit profile metadata | engine ready, no surface | `profile.save` carries name/about/picture/banner/NIP-05/website/lightning address; E/wire/actions.rs. No V/ control calls it. |
| Upload profile picture/banner | partial | Upload action and profile.save exist independently; no profile editor joins them. |
| Profile relay list | engine ready, no surface | `ProfileRow.relays` contains known outbox URLs; E/wire/sources.rs. V/rows.ts does not draw them. |
| Public mute people/words/tags/threads | done | Existing settings and note actions, with feed/notification hiding; E/settings.rs, V/settings-lists.ts, V/note-actions.ts. |
| Encrypted private list reading | partial | Local-key NIP-44 entries work; extension/bunker decrypt and historical NIP-04 do not; E/accounts.rs, N/list_crypto.rs. |
| Encrypted private list edits | missing | Public edits preserve ciphertext; removing private entries is refused. No encrypt/edit flow for any signer. |
| People/follow-set reading | engine ready, no surface | `open source:list` projects members and resolves addresses; E/wire/sources.rs, E/wire/query_translate.rs. No list tile in V/registry.ts. |
| People-set creation/edit and feed subscription | missing | No list-edit action or dedicated saved-set feed workflow. |
| User status and external identity proofs | missing | NIP-38/39 have no runtime projection or action. |

## Messaging, relays and payments

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| NIP-17 DMs and gift wrapping | engine ready, no surface | NIP-44 receive/send through all signers, per-recipient/self wrappers and private snapshots; E/dm/, W/worker_dm*.rs, docs/dm.md. |
| DM inbox relay list and delivery | engine ready, no surface | Kind-10050 discovery/edit, recipient/self inbox routing and per-envelope acceptance; dm.relays.save and dm.send. |
| DM conversations, unread marks and attachments | partial | Protocol6 conversation/text snapshots, durable read marks and history exist without a view. Dedicated attachments and a composer need further work. |
| Read old NIP-04 messages | engine ready, no surface | Read-only older decryption/projecting works for local, extension and bunker signers; no NIP-04 sending. |
| Public channels | done | NIP-28 discovery, metadata, join, send and unread marks; E/channels.rs, E/channel_actions.rs, V/channels.ts. |
| Public-channel moderator actions | missing | No kind-43/44 hide/mute action; ordinary personal mutes are distinct. |
| NIP-29 relay groups | missing | P/groups.rs has codecs; no engine membership/moderation or group view. |
| Read/write relay settings and NIP-65 | done | Verified list adoption, fallback and signed editing; E/discovery.rs, W/worker_relays.rs, V/settings-relays.ts. Visitor bootstrap edits also work. |
| NIP-11 scheduling limits | done | HTTP document fetch feeds subscription/filter/page limits; W/worker_relay_info.rs, E/network_limits.rs. |
| NIP-11 relay information surface | partial | Engine consumes limits but does not retain/project the complete information document; no detail view. |
| NIP-42 relay authentication | done | Explicit auth-required reads/writes use all signer kinds with current demand/owner checks. Optional NIP-67 EOSE hints remain unsupported; docs/relay-auth.md. |
| Relay health, request and delivery diagnostics | done | Real counters, errors, request purposes and attempted publication routes; E/feedback.rs, V/relays.ts, V/stats.ts. |
| Zap receipt display and totals | partial | Amounts come from receipt/description tags without trusted provider discovery; E/wire/note.rs, E/wire/notifications.rs, P/nip57.rs. Not verified payment totals. |
| LNURL discovery, zap signing and invoice retrieval | missing | N/zap.rs and N/invoice.rs validate structures but have no Worker flow. Existing zap button only explains unavailability. |
| WebLN, invoice payment/QR and NWC | missing | No payment contract or provider integration; V/note-actions.ts. NIP-47 is a separate missing wallet capability. |
| Per-note reactors and reposters | engine ready, no surface | Verified stored references/reactions retain actors; E/rows.rs, core store. No detail-query wire shape or view yet. |
| Trusted zapper list | partial | Stored receipts and actor parsing exist; provider validation and a detail-query shape are missing. |
| Reliable publication feedback and retry | done | Early success, bounded retries, late confirmations and retained composer drafts; E/network_delivery.rs, V/compose-outbox.ts. |

## Composition, saved material and content kinds

| Capability | Status | Concrete scope, limit and evidence |
| --- | --- | --- |
| Notes, replies, reposts and quotes | done | Read and publish through all existing signer types; E/wire/publish.rs, V/note-actions.ts, V/compose.ts. |
| Unicode/custom reaction picker | partial | Unicode/recent/own kind-10030 emoji work; referenced kind-30030 sets are not fetched; E/wire/sources.rs, V/emoji-picker.ts. |
| Selected mentions and custom emoji in text | done | Engine expands selected ranges and preserves emoji tags; E/wire/mentions.rs, V/compose-mentions.ts. |
| Image/video/audio upload | partial | Blossom and NIP-96 discovery, every signer and retries work; no intermediate byte progress or cancellation; W/worker_upload*.rs, V/compose-media.ts. |
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
| Background push notifications | missing | Notification feed is foreground/live only; no push subscription or service worker. |
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
| Installable offline shell and coherent updates | done | Real-build SHA-256 shell cache, failed-install rollback, offline navigation and activation after old tabs close; web/scripts/shell-cache.ts and smoke-offline.mjs. |
| Encrypted optional setup sync (78/44) | missing | Local same-origin UI storage is not encrypted cross-device sync. |

## Audit corrections and sources

The older table incorrectly called bunker signing, follow-list creation,
NIP-05 verification, uploads, public mutes/bookmarks, quotes, hashtag reading,
own-event deletion, grouped notifications and social Undo missing or narrower.
The handoff also overstates relay AUTH and pins; their runtime gaps are above.
status.md's visitor-settings guard warning is stale: V/settings-relays.ts already
calls the engine directly for a signed-out bootstrap save.

- [A] [Amethyst supported features](https://github.com/vitorpamplona/amethyst#supported-features), checked 2026-11-16.
- [B] [Coracle features](https://github.com/coracle-social/coracle#features), checked 2026-11-16.
- [C] [Nostr specifications](https://github.com/nostr-protocol/nips), checked 2026-11-16; distinguishes current identifiers from historical client labels.
