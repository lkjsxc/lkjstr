# Engine proposals

## Purpose

Additive protocol ledger. The 2026-11-16 owner delegation permits additive fields/messages with a line here; existing contracts stay intact.
Earlier sections retain their original context. Current behavior and limits are in status.md and parity.md.

## 1. Extension account discovery

Add a correlated main-thread capability request for NIP-07 getPublicKey, answered with the public key or a stable failure code. The current sign bridge
already requires a pubkey, so account.add/extension cannot discover the first
account through that bridge. Keep arbitrary signer error strings out of engine
logs. The headless harness proves exact-event signing and relay delivery once
a public key is known; account discovery remains unsupported.

## 2. Bootstrap and relay settings

Add explicit relay configuration to EngineConfig (or a separate configure
message), including read/write flags and search capabilities. Currently it
contains language, heuristics and prefetch only. A reader must be able to pick
relays before loading an account's kind 10002 or signing a relay-list change.
The engine currently bootstraps two existing app defaults; harness builds use
only explicit loopback relays. Preserve per-relay usage flags on relay-list save;
the current action adapter still needs that completion.

## 3. SharedWorker detach and recovery

Agree on a client heartbeat/detach mechanism, including a reconnect signal and
reopening visible queries after worker loss. No healthy silent client should
be expired by an undocumented timeout. Two-tab browser tests prove a single
socket, visibility isolation and release when both clients hide. Abrupt loss
of one port can still retain bounded wants while another keeps the worker
alive. The dedicated fallback needs a Web Locks leader plus BroadcastChannel;
a wall-clock lease can split leadership during suspension or clock changes.

## Query and failure evidence

Keep relaysAsked/Answered and expose failure distinctions for embedded quotes.
The quote union lacks an error state: an absent event after EOSE is different
from nobody answering. Native tests cover two-relay not-found and silent-peer
failure. Partial counts remain lower bounds even after every chosen relay
answers; no finite relay sample proves network-wide completeness.

## List editing and references

Refuse edits until a NIP-02/NIP-51 list is loaded; preserve unknown public tags
and opaque private content. Empty-list creation needs a remote-completion proof
or an explicit create action. Native tests prove refusal before load and
preservation during edits. Multi-language OR filters, NIP-05 search resolution,
addressable/private lists and complete notification grouping remain follow-up.

## Scheduling and measured indexing

Share visible wants and release them promptly. Use stable keys and hold anchors.
The measured 100000-event sparse-author workload improved from 3087.80 ms to
1.88 ms for 100 queries by merging existing author indexes. WASM measurements
are in engine-performance.md. This supports keeping filtering/indexing in Rust
and sending bounded finished windows; it does not prove a cold 100000-row disk
startup. Add disk compaction and that browser benchmark before claiming it.

## Count contract resolution (2026-11-15)

The frontend's protocol 2 remains authoritative. The proposed estimate objects
were rejected during integration. Unknown profile fields are absent; known
numbers use the existing partial flag. No alternate unknown representation.

## Protocol 5 owner decisions (2026-11-15)

Accepted by the frontend owner: another person's Home, bounded local mention
suggestions, explicit device profile requests, validated UTF-16 mention ranges
and kind-0 picture revisions. The frontend protocol.ts is authoritative.
The Rust mirror and mock implement it; see [wishes.md](wishes.md). Relay
selection and prioritization remain outside this change.
## Upload feedback (2026-11-15, accepted in frontend contract)

Upload actions may select one `server`; absent uses the first owner/default
server. Progress optionally includes `server` and `phase` (discovering, signing,
uploading, processing). Upload-specific failure codes distinguish network/CORS,
timeout, payment, discovery and invalid response. Existing byte progress and
result shapes remain compatible. ServerRow.ok records positive upload
confirmation, not a live health check. The frontend owns the additive fields in
protocol.ts. See media-uploads.md for bounds and browser evidence.

## Media server evidence

Additive frontend contract: ServerRow.checked distinguishes unknown from a fresh
required-request verdict; error carries the same translated code as upload.
servers.check retries required NIP-96 discovery or optional BUD-06. Optional
failures stay unknown. Evidence is session-only and shared across subscribers.

## Look corrections (2026-11-15)

Frontend protocol 5 adds optional Stats relay `route` words (reading, writing, both, search, own, unused). The engine derives these from configured relay usage.
Note `Counts.partial` now means an observed full relay page, not an unanswered request; the wire shape is unchanged. Preview failures and
untitled answers project no cards until cache expiry.

## Composer delivery lifetime (2026-11-15)

The frontend-owned Hint gains optional deliveryWatches, at most 128 action req
IDs per client. Existing delivery/result shapes stay unchanged. First success
resolves the action; delivery updates continue while that result is displayed.
Replacing the result or unmounting after settlement releases the listener; detach releases
its namespaced watches. Engine receipts retain the last 32 publications plus
watched results, bounded by 32 clients. Wire delivery includes only attempted
routes and retains relay refusal messages. Timeout means unknown; no protocol
contract number change or new user-facing state is needed.

## Protocol 6 engine additions (2026-11-16, owner authorized)

- `ToEngine.dm.open {sub,query:DmQuery}` adds an explicit private subscription.
- `ToEngine.dm.close {sub}` releases a private subscription and its wants.
- `ToEngine.dm.visible {sub,visible}` controls private work while preserving the displayed query anchor.
- `ToEngine.dm.more {sub}` advances encrypted history on the existing private query.
- `ToEngine.crypted {req,value?,error?}` answers correlated signer crypto without event parsing.
- `FromEngine.dm {sub,snapshot:DmSnapshot}` delivers private data outside public rows.
- `FromEngine.crypt {req,pubkey,peer,operation,data}` requests NIP-44 encrypt/decrypt or NIP-04 decrypt.
- `Action.dm.send {as,draft:DmDraft}` prepares and routes one encrypted wrap per participant.
- `Action.dm.seen {as,conversation}` durably records local conversation read state.
- `Action.dm.relays.save {as,relays}` publishes the account's DM inbox relay list.
- `DmQuery {account,conversation?,before?,limit?}` defines private account and cursor selection.
- `DmDraft {recipients,text,replyTo?,subject?}` defines private text without public mention parsing.
- `DmMessage {id,conversation,author,participants,at,text,replyTo,subject,legacy,unread}` supplies finished text and milliseconds.
- `DmConversation {key,participants,last,unread}` summarizes locally observed private messages.
- `DmSnapshot {account,conversations,messages,more,undecryptable,phase,error?}` carries bounded rows and honest private read state.
- `Action.account.importEncrypted {key,password}` imports an ncryptsec into ciphertext-only storage.
- `Action.account.unlock {pubkey,password}` unlocks a local encrypted key for this Worker session.
- `Action.account.lock {pubkey}` drops the unlocked key and decrypted private-message memory.
- `Action.account.exportEncrypted {pubkey,password,logN?}` explicitly creates an ncryptsec backup.
- `Result.encryptedKey?` carries only the explicitly requested encrypted backup.
- `Account.encrypted?` identifies ciphertext-backed local storage.
- `Account.locked?` identifies an account requiring session unlock.

All existing protocol messages and fields retain their meanings. No visible
surfaces are added without a specification. See [dm.md](dm.md), [keys.md](keys.md)
and [interface-needs.md](interface-needs.md) for contracts and remaining design.

## Protocol 7 lifetime additions (2026-11-16, owner authorized)

- `ToEngine.dm.open.visible?` supplies initial private visibility atomically; omission keeps the existing visible default.
- `ToEngine.upload.cancel {req}` cancels only that client's pending upload request and its authorization, HTTP and processing waits.
- `FromEngine.result.cancelled?` confirms cancellation by its owning queue or Worker, with `ok:false` and no pending effect.
- `FromEngine.sign.actionReq?` identifies the originating upload so cancelled authorization cannot start or consume a later signer request.
- `Engine.dm.open(query,receive,{visible?})` supplies the optional initial private visibility through the existing client API.
- `ActWatch.uploadSignal?` connects the existing attachment removal/clear/dispose controls to upload cancellation.

Private-list revocation adds no wire message: successful lock/remove commits
clear unauthorized decrypted list policy and replace derived row caches before
account/result output. Other authorized accounts and query/window intent remain.

## Protocol 8 interface additions (2026-11-16, owner authorized)

- `Account.inbox?` exposes the verified kind-10050 list; absent means unknown, and an empty array means no usable advertised inbox.
- `DmQuery.participants?` asks the engine to canonicalize a new conversation including the account, without frontend event hashing.
- `DmQuery.unreadOnly?` asks for counts without conversation previews, message bodies or people; the frame gates this on protocol 8.
- `DmMessage.segments?` provides inert engine-parsed text/link/mention/emoji parts without media or link-card requests.
- `DmMessage.reply?` gives the answered ID, author and first-line excerpt only from the same account and conversation.
- `DmConversation.recentAuthors?` supplies at most two recent distinct other authors for the specified group faces.
- `DmSnapshot.conversation?` returns the canonical conversation identity, including a conversation with no messages.
- `DmSnapshot.people?` provides public author projections needed by the private tab, independently of message bodies.
- `DmSnapshot.blocked?` names participants with confirmed missing or unusable inboxes; unknown discovery is not a confirmed absence.
- `DmSnapshot.unread?` reports unread messages across the bounded private inbox before the 200-conversation display cap.
- `DmDraft.emoji?` supplies used validated custom-emoji tags for the signed rumor and its recipient envelopes.
- `FromEngine.result.dmDelivery?` reports accepted/total participant envelopes, including self, with duplicate relay replies counted once.
- `Action.dm.draft.load {as,tab}` loads that account/tab's encrypted private state through its current signer session.
- `Action.dm.draft.save {as,tab,state,expected?}` saves encrypted state; a supplied stale revision cannot replace another editor's committed state.
- `Action.dm.draft.clear {as,tab,expected?}` removes only that private tab state, with the same optional revision guard.
- `DmDraftState {draft,failed}` retains an unsent draft and bounded failed sends without automatic publication or resend.
- `DmFailedDraft {key,draft,error?,dmDelivery?,id?}` retains retryable private content and observed outcomes inside the encrypted archive.
- `FromEngine.result.dmDraft?` returns loaded private state only to the requesting client; absence is an empty saved slot.
- `FromEngine.result.dmDraftRevision?` returns an opaque account/tab/generation revision even for absence and after successful save/clear.
- `Failure.code:signer-timeout` distinguishes an observed signer deadline from a missing signer or a relay/network timeout.
- `ToEngine.crypted.error:signer-timeout` lets a bounded extension call release its queue and discard a late reply.

- `Action.dm.editor {as,editor,open,dirty?}` acknowledges bounded private editor admission and tracks pending encrypted writes across page expiry.
- `FromEngine.dm.flush {req,account,phase}` holds participating editors during lock preparation and releases them after commit or failure.
- `ToEngine.dm.flushed {req,ok}` acknowledges only that port's exact lock preparation after its latest encrypted state commits.

The draft archive is local and encrypted for every signer kind, not account setup sync or a public list.
Bounds, atomic removal, conflicts and the Worker-scoped unlock limit are in [dm-drafts.md](dm-drafts.md).

## Protocol 9 zap additions (2026-11-16, integration candidate)

- `ToEngine.zap.quote {req,query:{target,amountMsat?}}` requests finite read-only provider/split evidence.
- `FromEngine.zap.quote {req,quote}` carries loading/ready/failed/unsupported evidence and recipient ranges.
- `ToEngine.zap.receipts {req,query:{target,before?,limit}}` requests a bounded trusted receipt page.
- `FromEngine.zap.receipts {req,page}` carries provider-authorized actors, exact amounts, provenance and independent relay coverage.
- `ToEngine.zap.close {req}` closes that client's finite read or cancels its invoice, including queued pre-ready work.
- `Action.zap.invoice {as,intent:{target,amountMsat,comment}}` explicitly signs HTTPS-only requests for unpaid invoices.
- `FromEngine.result.zapIntent?` carries only a validated complete unpaid intent; it never reports payment.
- `Counts.zapState?` distinguishes unresolved provider authority from relay truncation.
- `Counts.zapUnverified?` counts retained unresolved receipt candidates.
- `Counts.zapAmountMsat?` carries the exact decimal millisatoshi sum.
- `Counts.zapLimited?` marks fractional rounding or the numeric safe-integer cap.
- `NotificationRow.zapReceipt?` carries the same validated receipt provenance as the detail query.
- `SubState.zapEvidence?` reports unresolved notification trust separately from existing relay phase.
- `Account.unreadZap?` adds unread trust evidence and a bounded Seen-exception limit.
- `Engine.zaps?` exposes finite quote/receipt helpers with explicit close/dispose ownership.
- `ActWatch.zapSignal?` connects caller cancellation to invoice lifetime without an added control.
- Protocol 9: `reading {sub,key}` carries one delivered reading anchor independently of retained-window bounds; null restores window-anchor fallback.
