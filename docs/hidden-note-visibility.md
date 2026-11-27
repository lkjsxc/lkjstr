# Note visibility and missing rows

## Purpose

Baseline `29a62363a6ea449354b9a4036913e64fcfd57b47`. The table records
what could remove or cover content and how the #2803 candidate treats it.
Home is the current account plus its verified kind-3 follows. Their Home is
its named account's current follow list. Global does not need either list.
The published app home is <https://lkjstr.lkjsxc.com>.

## Inventory

| Cause | Scope and default | Layer and evidence | Reveal or setting |
| --- | --- | --- | --- |
| Person, thread, word, hashtag mute | Selected account's newest signed kind-10000 public and eligible private entries. Base ordinary windows and most projected views dropped matching notes. Bookmarks and quotes handled person mutes separately. Candidate covers matching notes in ordinary, channel, bookmark, thread, and profile windows. Thread matches the note ID, direct parent, or signed non-channel root. Person wins, then thread, word, hashtag. | [Mute policy](../crates/lkjstr-core/src/engine/query_hidden.rs) and [wire projection](../crates/lkjstr-core/src/engine/wire/visibility.rs). Word substring matches ignore case, and hashtag tag matches ignore ASCII case. Word and hashtag detail is at most 160 characters of the reader's own list entry. | Show the retained verified note for one subscription. The matching mute list is editable. |
| Content warning (NIP-36) | Any verified event carrying `content-warning`, including one with an empty reason. Header, actions and counts remain present. It folds body/media in the frontend. | [Warning projection](../crates/lkjstr-core/src/engine/rows.rs) sends `cw` separately. | Show/Hide inline and `set.showSensitive`. |
| Network, trust, web of trust | Home and Their Home intentionally select their author scope. Global has no follows restriction. At base only signed-out Global dropped a valid note once profile absence had been established. The candidate removes that gate. Trust weights route requests, and people directory and zap providers have separate eligibility. | [Source filters](../crates/lkjstr-core/src/engine/query.rs), [read weights](../crates/lkjstr-core/src/engine/weights.rs), [Global policy](../crates/lkjstr-core/src/engine/global.rs). A kind-0 lookup result says nothing about note authenticity. | Source choice, or edit follows. A missing profile has no suppression reason. |
| Repeated content or many notes from one author | Visitor Global only, default on. Three ordinary notes per author per window. Exact nonempty whitespace-normalized copies, or sufficiently long near-copies, within 600 seconds. Signed-in Global, Home, profile and thread bypass these limits. | [Bounded visitor classifier](../crates/lkjstr-core/src/engine/global.rs), up to 6000 candidates. Signed copies with different IDs may each occupy a slot. Repeated delivery of one ID never adds a slot. | Show per note, or change `signedOutGlobalFilter` (Settings visitor filter). |
| Machine payload | Verified kind-1 JSON documents or long unbroken encoded-looking text, previously covered with body already on the wire. Now receives a covered slot after mutes and before visitor burst checks. | [Heuristic](../crates/lkjstr-core/src/content.rs) and [reason policy](../crates/lkjstr-core/src/engine/visibility.rs). | Show per note. |
| Reply, kind, author, search, language and dates | Query selection: Home/Global default kinds 1/6, Channel kind 42, Thread its branch, Profile selected posts/replies/media or kind 6/16 or 7 activity, Hashtag tag match, saved bookmarks member IDs. Explicit replies/reposts/media/language/from/date and text predicates narrow results. Notifications are a separately selected and grouped activity query with account, actor, and zap checks. | [Membership predicate](../crates/lkjstr-core/src/engine/query.rs), [extra predicates](../crates/lkjstr-core/src/engine/query_predicates.rs), [thread graph](../crates/lkjstr-core/src/engine/thread.rs), [notification subject](../crates/lkjstr-core/src/engine/wire/notification_subject.rs). | Change the query. Membership, grouped act deduplication, and unsupported kinds create no hidden-note slot. |
| Unavailable repost target | Ordinary and profile activity windows cannot show a terminal note absent from the verified store. An observed wrapper does not prove the target's body, author or time. Their Home keeps a publicly muted signed wrapper as its own covered slot, without inventing the target. | [Window projection](../crates/lkjstr-core/src/engine/window_projection.rs), [act resolution](../crates/lkjstr-core/src/engine/acts.rs). Evidence reports an affected raw window without claiming a count of distinct notes. | Waiting or later verified retrieval can produce the ordinary row. No Show yet. |
| Deletion (NIP-09) | A verified kind-5 event's `e` reference applies when the target author matches the deletion author. A late copy can supply proof against an existing author-specific fence. A wrong author or invalid signature does not establish deletion. `a` coordinate deletion is not implemented here. | [Ownership and retention](../crates/lkjstr-core/src/store/retention.rs), [verified fences](../crates/lkjstr-core/src/store/context_pins.rs). The candidate watches at most 120 retained targets per visible view for kind 5. A delivered row can become a body-free tombstone at the same key. An unknown target never acquires an identity from a deletion request. | Never reveal. |
| Expiry (NIP-40) | Base had a codec with no note admission or display policy. Candidate applies one valid decimal expiry to verified public note/activity kinds 1, 6, 7, 16, 42, 30023. At or after it, new copies are rejected and retained rows leave memory. Ambiguous or malformed tags fail admission separately. | [Codec](../crates/lkjstr-nips/src/metadata.rs) and [clock/retention](../crates/lkjstr-core/src/store/expiration.rs). A previously delivered slot may become `expired`. Expired events outside the previously delivered window supply no slot. Physical rows committed before expiry can remain until bounded IndexedDB pruning. Restore applies the clock. | Never reveal. |
| Signature or event validation | Envelope parsing, wire subscription/filter checks, signature and event ID verification precede the event store. Invalid payloads and forged envelopes never supply UI identity, time, controls or a timeline row. | [Frame intake](../crates/lkjstr-core/src/engine/network_messages.rs), [verification](../crates/lkjstr-core/src/engine/tick.rs). `invalid` counts only observed failed relay deliveries assigned to a still-owned wire request. Unattributable malformed frames are device observations. | No Show. |
| Relay coverage, timing, ordering and duplicates | Relay choice, finite page size, EOSE, timeout, reconnection, live/history cursors, pressure and cancelled requests affect what is observed. Matching verified events are ordered by time and ID, with ancestry and activity order where specified. The raw frontier observes matching frames before signature verification. Only verified arrivals can advance the live replay watermark. A repeated known event is deduplicated. | [Request progress](../crates/lkjstr-core/src/engine/network_progress.rs), [queue bounds](../crates/lkjstr-core/src/engine/ingest.rs), [history](../crates/lkjstr-core/src/engine/history.rs). Incomplete coverage has no reliable count of unseen events. | Retry coverage where offered. No fabricated row or Show. |
| Cache retention | In-memory public store caps 16000 regular and 4000 replaceable events and 64 MiB of payload. IndexedDB prunes to 20000 newest event records and restores bounded checkpoints plus up to 2000 newest rows. | [Storage](architecture.md), [eviction](../crates/lkjstr-core/src/store/retention.rs). `pruned` refers to a previously delivered note with observed memory eviction. Other missing cache records do not identify a row. | Relay lookup may recover a verified copy. Reveal uses retained data. |

## Contract and bounds

Covered rows keep their verified position and key. The required existing note
fields carry only minimal identity and zero or empty body and controls. A
Show/Hide request acts on the current delivered row and retains at most 256
choices per open subscription (128 per client). Reopen resets the Worker
choices. The browser can reapply an explicit choice when it sees that row.
No local reveal publishes, modifies a mute, or creates a lookup. Revealed
rows and rows containing expiring content never seed public snapshot replay.

Content-warned notes keep attribution and delivery state in their headers.
Reply, notification and channel-list excerpts omit warned text. Compact thread
rows and closed warning bodies do not request link previews.

The outside-window evidence describes observed conditions, not a hidden-note
total. No invalid payload, alleged author, event ID or timestamp is emitted
as part of that evidence. EOSE describes a queried page and cannot certify
global completeness. Full pages, retry, and quiet live tails retain their
separate request semantics.

## Their Home public mute scope

The viewed owner's latest verified kind-10000 list contributes public `p`, `e`, `t` and `word` tags only.
Viewer public and eligible private mutes run first and stay account-owned. Another user's encrypted private mutes
cannot be read, and even a private list already decrypted for another saved account is excluded from this view.
Public entries use the same person, event/parent/root, case-insensitive word and hashtag matching as viewer mutes.
Projection and history read the relevant public tags directly from the owner's compact list.
A matching note keeps a covered slot with a `their-muted-*` reason. Quotes and reply excerpts also respect this
scope. Why offers no viewer Settings link; Show/Hide changes only that subscription and never edits either list.

Each visible Their Home watches kinds 3 and 10000 separately, retaining the newest observed signed list for each
kind. Newer timestamps replace older lists; equal timestamps use the lower event ID. An empty newer public list
clears the public policy even when its content is encrypted. Missing lists supply no invented mute entries.
History and ordinary/Moment projections use the current observed list; this does not reconstruct historical mutes.
Both list watches and read-dependency pins release when the view hides or closes. There is no target account pin.
Snapshots created before this scoped policy use an obsolete identity and cannot replay. Revealed bodies and
private matching-entry details remain excluded from public snapshots; a fresh cover replaces old visible content.

A publicly muted repost keeps its own signed ID and time as a covered slot. An independently admitted original
remains visible unless it is itself muted. Muted repost actors do not reappear in original-note attribution;
ordinary windows, time-rail ordinals and Moment placement use the same rule. The viewer's own repost action state is unchanged.

Interaction totals retain the viewer's existing policy and count evidence. The target's public mutes govern displayed content, not count authority.
