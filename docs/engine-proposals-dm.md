# Early private-message protocol additions

## Purpose

Historical entries retained from [engine-proposals.md](engine-proposals.md). Current scope and limits are in
[status.md](status.md) and the private-message design documents.

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
