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
- When an item is built: `pnpm shots` with a scene per state named in the item, and its State below set to `built`.
  The design owner judges one picture per batch: a JPEG contact sheet, at most 2000 px on its long side, holding each
  scene once at 1440 dark and once at 390 light with its scene name, written to
  `/home/coder/workspace/lkjstr-review/<first item id>-<yyyymmdd>.jpg` (outside the repository, so that cleaning `tmp/`
  does not take it) and named in the desk note. The rules that come out of it are folded into design.md.
- The sheets of K1 to D1 were removed with `tmp/` before they were judged. Make that one sheet again
  (`K1-<yyyymmdd>.jpg`, the scenes of the keys and messages items, same form) with the A items.
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
| A1 | Notification about the reader's reaction or repost | [interface-acts.md](interface-acts.md#a1-notification-about-the-readers-reaction-or-repost) | built |
| A2 | A person's reaction or repost of an act, in their profile | [interface-acts.md](interface-acts.md#a2-a-persons-reaction-or-repost-of-an-act-in-their-profile) | built |
| E1 | One emoji picker: frequent, sets, categories, tones, search | [interface-emoji.md](interface-emoji.md#e1-the-picker) | built |
| E2 | The picker's fixed preview strip | [interface-emoji.md](interface-emoji.md#e2-the-preview-strip) | built |
| E3 | The emoji popover (custom and Unicode) in notes, names and reactions | [interface-emoji.md](interface-emoji.md#e3-the-emoji-popover) | built |
| E4 | The picker's custom emoji tab: list and sets, empty line, headed search | [interface-emoji.md](interface-emoji.md#e4-the-custom-emoji-tab) | built |
| T1 | Thread: the focused note | [interface-thread.md](interface-thread.md#t1-the-focused-note) | built |
| T2 | Thread: the notes above, compact, and the room of a missing one | [interface-thread.md](interface-thread.md#t2-the-notes-above) | built |
| T3 | Thread: replies as a conversation, long branches folded | [interface-thread.md](interface-thread.md#t3-replies) | built |
| T4 | Thread: the reply field under the focus | [interface-thread.md](interface-thread.md#t4-the-reply-field) | built |
| C1 | Time label beside the thumb while a timeline scrolls | [interface-time.md](interface-time.md#c1-the-scroll-label) | built |
| C2 | Wide scrubber: local year, month and day marks, hover | [interface-time.md](interface-time.md#c2-the-wide-scrubber) | ready |
| C3 | Time jumps by mouse, touch and keyboard, and their loading | [interface-time.md](interface-time.md#c3-jumps-and-loading) | ready |
| C4 | A note's time opens the author's Home at that moment (cache only) | [interface-moment.md](interface-moment.md#spec-c4-the-moment-tab-cache-only-the-existing-worker) | built |
| C5 | The moment from relays in both directions | [interface-moment.md](interface-moment.md#spec-c5-both-directions-from-relays-needs-engine-r1-to-r6-ui-only-after-them) | older built; newer needs engine |
| Q1 | Tabs state wants; the engine makes one plan | [read-plan.md](read-plan.md#q1-tabs-state-wants-the-engine-makes-one-plan) | ready |
| Q2 | Ask where the answer is | [read-plan.md](read-plan.md#q2-ask-where-the-answer-is) | ready |
| Q3 | Weights made from the past | [read-plan.md](read-plan.md#q3-weights-made-from-the-past) | ready |
| Q4 | Spend where it brings most | [read-plan.md](read-plan.md#q4-spend-where-it-brings-most) | ready |
| Q5 | A scorecard that is climbed | [read-plan.md](read-plan.md#q5-a-scorecard-that-is-climbed) | ready |
| Q6 | Lists are kept, not asked again at every start | [read-plan.md](read-plan.md#q6-lists-are-kept-not-asked-again-at-every-start) | ready |
| Q7 | A wider set to start from | [read-plan.md](read-plan.md#q7-a-wider-set-to-start-from) | ready |

C1 to C3 are the owner's item 5 of 2026-11-21. C1 needs no engine change and lands alone; C2 and C3 draw local
day marks once the engine answers `days`, and until then fall back to today's marks without inventing a day.
Keys come first because a locked account changes what the Messages tab says. A1 and A2 are the owner's request of
2026-11-17 and are the next interface work: build them before anything under "Not specified yet".
Q1 to Q5 are the owner's direction of 2026-11-17 and replace S1, which is withdrawn: the moment at which each tab
draws does not matter; what matters is that the engine plans every tab's wants together, from weights made of the
past, and asks the relays as well as it possibly can. They are engine work without a surface. Q1 is taken first,
with the cache and first-paint work; A1 and A2 are small and are not delayed by Q2 to Q5.
Q6 and Q7 are the owner's words of 2026-11-17 02:42 UTC: relay lists and the other slow lists are kept on the
device instead of being asked again at every start, and the default relays become three wider measured sets. Q6
lands with Q1 or straight after it; Q7 ships with the next ship that has room.

Built on 2026-11-16 with protocol 8 and all required gates passed. The review
matrix covers 468 specified width/theme/language captures; real flows passed
13 key and 16 message checks. Evidence, exact sheet paths and limits are in
[interface-verification.md](interface-verification.md). K2 retains its recorded
Worker-scoped unlock and coordinated-lock differences; design judgement remains
with the design owner.

## Home new-notes pill

In Home, the existing new-notes pill uses `feed.freshOwn` when the newest row
above the reading place is the reader's note. It keeps the same count, colour,
and press-to-top behavior. Other arrivals keep the usual count label.

## Not specified yet

Do not build these; they are the next batches, in this order: actor lists for reactions, reposts and zap receipts; a
placeholder row for a bookmark whose note is unavailable; pins; a per-person relay-list view. Group subjects, private
files, message reactions and deletion wait for the engine.
