# Interface specifications

## Purpose

What to build in `web/` for engine capabilities that had no surface, written by the owner of the look and the words.
Each item names its structure, its states and its strings. [interface-needs.md](interface-needs.md) is the other side:
what the engine offers and no surface reaches yet.

## How to build an item

- Every visible string is already in `web/src/shared/strings-en.ts` and `strings-ja.ts` under the key the item names.
  Use the keys; write no words. A missing word is reported in one line under the item, not invented.
- Colours, sizes and behaviour come from [design.md](design.md). A new surface reuses the parts named in the item
  (`feed.ts`, `channel-desk.ts`, `account-key.ts`); it brings no new colour, shadow or motion.
- Where an item says "additive", the engine field or message does not exist yet: add it under the usual rule (one line
  in `engine-proposals.md`), with the mock answer. Until it exists, build the stated fallback.
- When an item is built: `pnpm shots` with a scene per state named in the item, the sheet named in the desk note, and
  its State below set to `built`. The design owner then judges the sheet and folds the rules into design.md.
- Order: top to bottom. An item is small enough to land alone.

## Items

| Id | Item | Spec | State |
| --- | --- | --- | --- |
| K1 | Sign in with a password-protected key | [interface-keys.md](interface-keys.md#k1-sign-in-with-a-password-protected-key) | built |
| K2 | Locked accounts: unlock, lock, idle lock | [interface-keys.md](interface-keys.md#k2-locked-accounts) | built |
| K3 | Back up key: protected copy first | [interface-keys.md](interface-keys.md#k3-back-up-key) | built |
| K4 | Protect a key already on the device | [interface-keys.md](interface-keys.md#k4-protect-a-key-already-on-the-device) | built |
| M1 | Messages tab | [interface-dm.md](interface-dm.md#m1-messages-tab) | built |
| M2 | Conversation tab | [interface-dm.md](interface-dm.md#m2-conversation-tab) | built |
| M3 | Writing a private message | [interface-dm.md](interface-dm.md#m3-writing) | built |
| M4 | Inbox relays | [interface-dm.md](interface-dm.md#m4-inbox-relays) | built |
| M5 | Signers that ask | [interface-dm.md](interface-dm.md#m5-signers-that-ask) | built |
| M6 | New-message mark on the account | [interface-dm.md](interface-dm.md#m6-new-message-mark) | built |
| D1 | Docs pages for both | [interface-dm.md](interface-dm.md#d1-docs-pages) | built |
| A1 | Notification about the reader's reaction or repost | [interface-acts.md](interface-acts.md#a1-notification-about-the-readers-reaction-or-repost) | ready |
| A2 | A person's reaction or repost of an act, in their profile | [interface-acts.md](interface-acts.md#a2-a-persons-reaction-or-repost-of-an-act-in-their-profile) | ready |

Keys come first because a locked account changes what the Messages tab says. A1 and A2 are the owner's request of
2026-11-17 and are the next interface work: build them before anything under "Not specified yet".

Built on 2026-11-16 with protocol 8 and all required gates passed. The review
matrix covers 468 specified width/theme/language captures; real flows passed
13 key and 16 message checks. Evidence, exact sheet paths and limits are in
[interface-verification.md](interface-verification.md). K2 retains its recorded
Worker-scoped unlock and coordinated-lock differences; design judgement remains
with the design owner.

## Not specified yet

Do not build these; they are the next batches, in this order: actor lists for reactions, reposts and zap receipts; a
placeholder row for a bookmark whose note is unavailable; pins; a per-person relay-list view. Group subjects, private
files, message reactions and deletion wait for the engine.
