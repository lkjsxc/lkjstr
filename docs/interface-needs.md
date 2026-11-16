# Interface needs

## Purpose

Engine capabilities awaiting Claude's written visible specifications. No new
strings, CSS, layout or controls are implied by this list.
Both sections below are specified in [interface-specs.md](interface-specs.md) (items K1 to K4, M1 to M6, D1).

## Private messages

| Capability | Engine contract and user need |
| --- | --- |
| Conversation list | `dm.open {sub, query:{account}}` returns `dm {sub, snapshot}` with `conversations:[{key,participants,last,unread}]`, phase, error?, more and undecryptable. The user wants to find a conversation and understand incomplete or unavailable reads. |
| Conversation | `dm.open {sub, query:{account,conversation,before?,limit?}}` returns `messages:[{id,conversation,author,participants,at,text,replyTo,subject,legacy,unread}]`. The user wants to read, retain position, page back and distinguish older messages. |
| Reading | `dm.seen {as,conversation}` commits the local read marker; `dm.more {sub}` fetches older wrappers; `dm.visible {sub,visible}` and `dm.close {sub}` release relay work. The user wants unread state and scrolling that do not lose their place. |
| Compose | `dm.send {as,draft:{recipients,text,replyTo?,subject?}}` returns existing correlated result/delivery. The user wants one-to-one or group private text with honest partial-delivery and signer errors. |
| Inbox settings | `dm.relays.save {as,relays}` signs kind 10050; sending requires every participant's advertised inbox. The user wants to choose where private messages arrive and understand a recipient with no usable inbox. |
| Extension permissions | `crypt {req,pubkey,peer,operation,data}` / `crypted {req,value?,error?}` supports NIP-44 encrypt/decrypt and older decrypt. The user wants understandable signer access and retry without repeated unsolicited prompts. |

The existing engine client exposes `Engine.dm?.open(query, receive)` returning
`id`, `visible`, `more` and `close`. Private snapshots stay out of public row and
profile caches. Read [dm.md](dm.md) for bounds and current history limits.

## Encrypted local keys

| Capability | Engine contract and user need |
| --- | --- |
| Import | `account.importEncrypted {key,password}` accepts ncryptsec; `Account.encrypted?` and `Account.locked?` indicate device state. The user wants to import an encrypted key without storing plaintext. |
| Session | `account.unlock {pubkey,password}` and `account.lock {pubkey}` control session access. The user wants to unlock once per session, understand a locked account, and clear decrypted message memory on lock. |
| Backup | `account.exportEncrypted {pubkey,password,logN?}` returns `result.encryptedKey?` only for an explicit export. The user wants a password-protected backup and verified recovery instructions. |
| Migration | existing plaintext accounts remain usable. The user needs a specified password/unlock/backup flow before converting storage; never silently replace a working key. See [keys.md](keys.md) for the ciphertext transaction and limits. |
