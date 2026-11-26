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
- An item is marked `ready` only after its look was drawn once on a fixture, even roughly. C2 put month marks at
  the 1st (`mm/01`), against its own newest-note rule, and its year label hid the newest month: both showed only
  when built (2026-11-22).
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
| C2 | Wide scrubber: local year, month and day marks, hover | [interface-time.md](interface-time.md#c2-the-wide-scrubber) | built |
| C3 | Time jumps by mouse, touch and keyboard, and their loading | [interface-time.md](interface-time.md#c3-jumps-and-loading) | built |
| C4 | A note's time opens the author's Home at that moment (cache only) | [interface-moment.md](interface-moment.md#spec-c4-the-moment-tab-cache-only-the-existing-worker) | built |
| C5 | The moment from relays in both directions | [interface-moment.md](interface-moment.md#spec-c5-both-directions-from-relays-needs-engine-r1-to-r6-ui-only-after-them) | older built; newer needs engine |
| W1 | "via <client>" by a note's time | [interface-client.md](interface-client.md#w1-where-it-stands) | built |
| W2 | Client names are relay text: drawn as text, bounded | [interface-client.md](interface-client.md#w2-text-from-relays) | built |
| W3 | App information on a press | [interface-client.md](interface-client.md#w3-app-information) | built on the mock; engine in progress |
| W4 | Include lkjstr in my posts (opt-out) | [interface-client.md](interface-client.md#w4-leaving-lkjstr-out-of-ones-posts) | built |
| Q1 | Tabs state wants; the engine makes one plan | [read-plan.md](read-plan.md#q1-tabs-state-wants-the-engine-makes-one-plan) | ready |
| Q2 | Ask where the answer is | [read-plan.md](read-plan.md#q2-ask-where-the-answer-is) | ready |
| Q3 | Weights made from the past | [read-plan.md](read-plan.md#q3-weights-made-from-the-past) | ready |
| Q4 | Spend where it brings most | [read-plan.md](read-plan.md#q4-spend-where-it-brings-most) | ready |
| Q5 | A scorecard that is climbed | [read-plan.md](read-plan.md#q5-a-scorecard-that-is-climbed) | ready |
| Q6 | Lists are kept, not asked again at every start | [read-plan.md](read-plan.md#q6-lists-are-kept-not-asked-again-at-every-start) | ready |
| Q7 | A wider set to start from | [read-plan.md](read-plan.md#q7-a-wider-set-to-start-from) | ready |
| N1 | One kind table instead of the kind allow-lists (engine) | [interface-view.md](interface-view.md#n1-one-kind-table-engine-no-surface) | built |
| E7 | Two emoji under one shortcode both appear and work | [interface-emoji.md](interface-emoji.md#e7-two-emoji-under-one-shortcode) | built |
| E6 | Custom emoji and the Unicode table ready before the picker opens | [interface-emoji.md](interface-emoji.md#e6-ready-before-the-picker-opens) | ready |
| N2 | The generic face; every kind opens; profile Articles, Lists, All | [interface-view.md](interface-view.md#n2-the-generic-face-and-every-kind-opens) | built (private; review pending) |
| N3 | Embedded events and chains, lazy, with depth and cycle limits | [interface-view.md](interface-view.md#n3-embedded-events-and-chains) | ready |
| N4 | Acts are posts: act focus, Who reacted, reacting to an act | [interface-view.md](interface-view.md#n4-acts-are-posts) | ready |
| N5 | Lists (NIP-51) as lists of openable items | [interface-view.md](interface-view.md#n5-lists) | ready |
| N6 | Articles: the card and the reading view | [interface-view.md](interface-view.md#n6-articles) | ready |
| N7 | Deep links and Copy link for every kind | [interface-view.md](interface-view.md#n7-deep-links-and-copying-for-every-kind) | built (private; review pending) |
| P1 | Edit profile: fields, picture and banner upload, preview, save | [interface-profile.md](interface-profile.md#p1-edit-profile) | built |
| R1 | Relay tab: one relay, its NIP-11 head and the notes it served | [interface-relay.md](interface-relay.md#r1-a-relay-tab) | built |

C1 to C3 are the owner's item 5 of 2026-11-21, built: C2 and C3 draw local day marks from the engine's `days` and
fall back to UTC months without inventing a day. They reach only lists the engine gives the rail (interface-time.md,
Reach); a Home with resolved reposts still scrolls natively, and that engine slice is the next step.
Keys come first because a locked account changes what the Messages tab says. A1 and A2 are the owner's request of
2026-11-17 and are the next interface work: build them before anything under "Not specified yet".
Q1 to Q5 are the owner's direction of 2026-11-17 and replace S1, which is withdrawn: the moment at which each tab
draws does not matter; what matters is that the engine plans every tab's wants together, from weights made of the
past, and asks the relays as well as it possibly can. They are engine work without a surface. Q1 is taken first,
with the cache and first-paint work; A1 and A2 are small and are not delayed by Q2 to Q5.
N1 to N7, E6 and E7 are the owner's #3597 of 2026-11-22: view almost anything, react to a reaction, preloaded
emoji with both of two same-code emoji usable. N1 comes first and changes nothing visible; E7 and E6 do not depend on
it and may run beside it. N2 needs N1; N3 needs N2; N4 needs N3; N5 and N6 need N3; N7 lands with N2. Pictures:
`/home/coder/workspace/lkjstr-review/N-20261122-*.png`.
Q6 and Q7 are the owner's words of 2026-11-17 02:42 UTC: relay lists and the other slow lists are kept on the
device instead of being asked again at every start, and the default relays become three wider measured sets. Q6
lands with Q1 or straight after it; Q7 ships with the next ship that has room.

Built on 2026-11-16 with protocol 8 and all required gates passed. The review
matrix covers 468 specified width/theme/language captures; real flows passed
13 key and 16 message checks. Evidence, exact sheet paths and limits are in
[interface-verification.md](interface-verification.md). K2 retains its recorded
Worker-scoped unlock and coordinated-lock differences; design judgement remains
with the design owner.

## Sending

The Post tab, Home draft and signed note use the same delivery state. Signing keeps
the existing Sending mark. After ten seconds the mark names a still-waiting
extension or remote signer. The first accepting relay answer shows Sent and clears
the draft. Late answers update its count. A note with no acceptance at its deadline
shows unconfirmed and keeps Retry, Edit and Remove. All refusals show the relay
messages. Details list up to five refused or unanswered relays followed by the
number of remaining ones. See [Writing and acting](design.md#writing-and-acting).

## Home new-notes pill

In Home, the existing new-notes pill uses `feed.freshOwn` when the newest row
above the reading place is the reader's note. It keeps the same count, colour,
and press-to-top behavior. Other arrivals keep the usual count label.

## Not specified yet

Do not build these; they are the next batches, in this order: a
placeholder row for a bookmark whose note is unavailable; pins; a per-person relay-list view. Group subjects, private
files, message reactions and deletion wait for the engine.
