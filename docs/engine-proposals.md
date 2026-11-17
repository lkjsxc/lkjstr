# Engine proposals

## Purpose

Additive protocol ledger. The 2026-11-16 owner delegation permits additive fields/messages with a line here; existing contracts stay intact. Earlier
sections retain their original context. Current behavior and limits are in status.md and parity.md.

Earlier context through protocol 5 is preserved in [engine-proposals-history.md](engine-proposals-history.md).

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

## Protocol 9 zap additions (2026-11-16, owner authorized)

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

## Protocol 10 private list additions (2026-11-16, owner authorized)

- Add `Query.privateLists?` for visible, account-scoped external list-read opt-in.
- Add `open.visible?` to make initial ordinary subscription visibility atomic.
- Add `crypt.context?` with `{kind:'private-list',sub,event}` for purpose and view ownership.
- Add `crypt.cancel {req}` to invalidate a queued or in-flight private-list signer request.
- Add `SubState.privateLists?` with phase, pending/failed container counts and optional error.
- Add `lists.retry {as}` to reset only this account's private-list refusal/capability failures.
- Add `Account.privateLists?` to qualify unread policy, including unknown without admitted work.

## Protocol 11 signer authorization additions (2026-11-16, integration candidate)

- `signer.auth {id,peer,method,url,expiresAt,account?,actionReq?}` exposes one verified, ephemeral challenge only to its initiating client.
- `signer.auth.clear {id}` withdraws that challenge on completion, cancellation, expiry or revoked authority.
- `signer.auth.cancel {id,reason?:'unsupported'}` cancels only the originating client's exact opaque handle.
- `Engine.signerAuth?` exposes an in-memory pending signal and explicit cancellation; it never opens, fetches or persists URLs.
- Current method names, deadlines, recipient ownership and unsupported fallback paths are specified in [bunker-auth.md](bunker-auth.md).

## Protocol 12 storage inspection additions (2026-11-16, verified)

- `storage.inspect {req}` requests one owner-scoped, finite observation; it does not mutate storage.
- `storage.close {req}` cancels only that client's pending observation and suppresses late effects.
- `storage {req,report:StorageReport}` returns independently settled memory, row-count and origin components.
- `StorageReport.startedAt` records admission in this Worker's monotonic millisecond clock.
- `StorageReport.finishedAt` records report settlement in that same clock; neither time is UTC.
- `StorageReport.memory.events` counts retained signed-event records at admission.
- `StorageReport.memory.eventPayloadBytes` sums retained event string bytes, preserving existing Stats semantics.
- `StorageReport.memory.at` records the memory observation, separate from later browser callbacks.
- `StorageReport.persistedEvents.phase` is ready, unsupported, failed or timeout; unknown has no numeric substitute.
- `StorageReport.persistedEvents.count` exists only for a successful readonly events transaction's exact row count.
- `StorageReport.persistedEvents.at` records that transaction's completion callback, only when ready.
- `StorageReport.origin.phase` independently describes the browser estimate's ready/unsupported/failed/timeout outcome.
- `StorageReport.origin.usage` carries only the returned safe-integer approximate origin usage when ready.
- `StorageReport.origin.quota` carries only the returned safe-integer approximate origin quota when ready.
- `StorageReport.origin.approximate` is always true for a ready origin estimate; it is not physical event-cache size.
- `StorageReport.origin.at` records the estimate callback in the same Worker clock, only when ready.
- `Engine.storage?` offers `inspect({signal?})` with bounded cancellation and no replay across Worker lifetimes.

Inspection bounds and verification limits are in [storage-inspection.md](storage-inspection.md).
Merged gate and exact production evidence are in [engine-device-verification.md](engine-device-verification.md).

## Protocol 13 public cache additions (2026-11-17, owner authorized)

- `cache.policy {sub,allow}` authorizes only public projected rows for a bounded pre-Worker rendering cache.
- Private-list-derived rows and all DM/key/action messages remain ineligible.
- `cache.hold {sub,rows:[{key,id?,profiles?:[{pubkey,id}],quotes?:[{id}]}]}` announces at most 64 held rows and bounded
  verified-reference identities, never event bodies.
- `cache.reconcile {sub,removedKeys,invalidProfileIds,removedQuoteIds}` invalidates only announced public references after
  verified author-owned deletion; mock emits empty arrays.
- Holds are separate from engine-delivered rows and release on close or cache-policy revocation; absence, EOSE and arbitrary cache content confer no authority.
- `Counts.context?` carries a contributor lineage, canonical decimal generation, opaque token, restored flag and current flag.
- `Counts.context.selection?` binds account and committed public-mute ID/time to the contributor token;
  older/unknown/pending selection cannot replace held counts.
- Only a restored same-lineage generation that is at least as new can replace a held count basis; equal generations require equal tokens.
- Tokens establish equality only. Changed lineages require explicit navigation; only current committed count models are durably captured.

See [public-view-cache.md](public-view-cache.md). These additions are unshipped and retain all prior protocol meanings.
