# Interface specification: private messages

## Purpose

The surfaces for private messages: the Messages tab, a conversation tab, writing, inbox relays, signer prompts and the
new-message mark. Engine contract: [dm.md](dm.md). Index and rules: [interface-specs.md](interface-specs.md). A
conversation is built like a channel on purpose: whoever knows one knows the other.

## Shared rules

- Two view kinds in `registry.ts`: `messages` (title `view.messages`, hint `view.messages.hint`) and `message` (titled
  by its people, hint `view.message.hint`, not offered by the launcher). Both are gated like channels (`gated.ts`,
  protocol 6, line `dm.unsupported`).
- `Alt+Shift+M` goes to the Messages tab (`goMessages: go('M')`, `key.goMessages`), opening one in the keyed tile when
  none is open.
- Private text never leaves the tab that shows it: no tab-search match on message text, no `localStorage`, no toast
  that quotes a message. A tab stores its people and its reading anchor; drafts follow the channel rule.
- Every `dm.open` gets `dm.visible` with the tab's visibility and `dm.close` on unmount.
- Before any content, in this order, one centred quiet line replaces the tab: signed out, the Sign in button used by
  an account's own list; public key only, `dm.readonly`; locked, `dm.locked` with the button `account.unlock`; M5's
  question; then the list.
- People are named as everywhere: name, or a short npub until it arrives. Several names join with `list.sep`. A face
  opens the profile.

Implementation note: the shortcut binds Alt+Shift+M explicitly; the existing `go('M')` helper means G then M.

## M1 Messages tab

The first row scrolls away with the list, as the Channels field does.

**Find row.** One field, placeholder `dm.find`. Typing narrows the conversations below by the names of their people.
Under them, a rule, then people from the directory the composer's `@` uses (follows first) who match and have no
one-to-one conversation yet; a pasted npub or NIP-05 address is resolved the same way. Nothing matches: `dm.none`.
Enter takes the first row. Taking a person opens the conversation tab with them (M2).

**Conversation row.** Height and rhythm of a Channels row.

- Face: the other person; for a group the two most recent other authors overlapped by a third.
- Line 1: names of everyone but the reader, 600, one line, elided; for a group followed by `dm.people` in `--faint`.
  Right-aligned: the time of `last`, in the feed's time form.
- Line 2: `last.text` on one line in `--muted`, elided; the reader's own message is wrapped in `dm.you`. Right-aligned
  in a fixed slot: `unread` as the vermilion count Channels uses (`dm.unread` as its label), nothing at 0.
- Order: `last.at`, newest first. A press opens the conversation after the current tab, in front; Shift and middle
  click as for a note.
- With no conversation the reader is the only participant of: not drawn.

**Ends.** One quiet centred line, by snapshot:

| Snapshot | Line |
| --- | --- |
| `phase: loading`, no rows | `dm.loading` |
| `phase: failed` | `dm.failed`, or `error` mapped through `error.<code>`, with the button `dm.retry` (close and open again) |
| rows empty, `phase: live` | `dm.empty` |
| `more` and the end is reached | send `dm.more`; `dm.older` while waiting |
| not `more`, rows present | `dm.end` |
| 200 conversations | `dm.capped` in place of `dm.end` |
| `undecryptable` above 0 | `dm.undecryptable`, one more line under the end line, `--faint` |

The reader's own inbox list is empty (M4): the row under the find row is `dm.setup` with the button `dm.setup.go`, and
the list is still drawn.

Scenes: list with one-to-one, group and unread rows; find with people offered; loading; empty; failed; setup line;
locked; read-only.

## M2 Conversation tab

A feed, newest first. The head and the composer are the first row and scroll away, as in a channel
(`channel-desk.ts`).

**Head.** Faces and names of everyone but the reader; each opens its profile. For a group, `dm.people` after the
names. At the right a more menu with `dm.addPerson`: it opens the people picker of the find row with
`dm.addPerson.hint` as its first line; choosing someone opens the conversation of the larger set in a new tab after
this one. With 32 people the entry is off and says `dm.full`. No lock icon, no explanatory line: the Docs page
explains.

**Message row.** A note row without the action row.

- Avatar column, then name (600) and right-aligned time; day dividers as in any feed. Consecutive messages by one
  author within five minutes share one face and header; the others keep only the time in the tooltip.
- Text at note size with the note's link, emoji and fold rules. No link cards, no media boxes: an address stays a
  link.
- `subject` not null and different from the message below it: one 600 line above the text.
- `replyTo`: above the header in `--faint`, `dm.inReply` with the author of the answered message and its first line,
  elided; a press scrolls to it when it is in the window. Not known: `dm.replyGone`.
- `legacy: true`: `dm.legacy` after the time in `--faint`, tooltip `dm.legacy.tip`.
- `unread: true`: the vermilion bar at the left.
- On hover or keyboard selection, at the right of the header, in `--faint`: reply (the reply icon, label
  `compose.reply`) and a more menu with `dm.copy`. `R` on the selected row replies.

**Reading.** The window is asked with `limit` 100; reaching the old end asks again with `before` set to the oldest id,
then `dm.more` when `more` is true (`dm.older` while waiting, `dm.end` after). The reading anchor is kept as in a
feed. An empty conversation shows `dm.first` under the composer.

**Seen.** While the tab is in front, the page visible and the newest message on screen, send `dm.seen` once per newest
id. Bars already drawn stay until the tab is next brought to the front, so nothing changes under the reader.

Scenes: one-to-one with a reply, an old-format message and unread bars; group with a subject; empty; paging line;
narrow tile.

## M3 Writing

The channel composer with these differences.

- Placeholder `dm.say` with the other person's name, or `dm.sayGroup` with the count of the others. The primary button
  is `dm.send`. `Mod+Enter` sends. Emoji is offered; attaching and `@` are not drawn.
- Replying shows `compose.replyingTo` and the first line above the field with its own remove button; the draft carries
  `replyTo`.
- Over 16 KiB of UTF-8: the button is neutral and `dm.tooLong` stands under the field.
- Pressing Send empties the field and keeps the caret there. The message is drawn at once below the composer with
  `compose.pending` in place of its time. When the result is ok the pending row gives way to the row from the snapshot
  without moving the list.
- A failure keeps the row, red only now, with one reason line and `compose.retry`, `compose.edit`, `compose.drop`,
  surviving a reload:

| Result | Reason line |
| --- | --- |
| some people reached, not all | `dm.fail.partial` with the counts of people |
| nobody reached | `dm.fail.none` |
| `signer-refused` | `dm.fail.refused` |
| signer deadline passed | `dm.fail.timeout` |
| `signer-missing` on a locked account | `dm.locked` with `account.unlock` |
| signer without NIP-44 (`unsupported`) | `dm.signerOld`, no Retry |
| anything else | `error.<code>` |

- **Nobody to send to.** Additive: `DmSnapshot.blocked?: Pubkey[]`, the participants with no usable inbox list. When
  it is not empty the composer gives its place to `dm.noInbox` with those names. When the reader is among them the
  line is `dm.setup` with `dm.setup.go` instead. Fallback until the field exists: the same lines appear as the reason
  of the failed row.

Scenes: pending, partial failure, refused, nobody to send to, too long.

## M4 Inbox relays

Setting `set.dmRelays` with `set.dmRelays.d`, in a group of its own after the relay entries, built from the relay-list
editor of Settings (`settings-relays.ts`): rows with remove, a field with Add, Undo on remove.

- Additive: the reader's current kind 10050 list is needed to draw it (`Account.inbox?: string[]` or an equal field).
  Fallback: draw the editor empty with the suggestion below.
- Unlike other settings it is not saved on change: the button `set.dmRelays.save` sends `dm.relays.save` and is
  neutral while the list equals the published one. Success: toast `set.dmRelays.saved`. Failure: the mapped error in a
  toast; the edited list stays.
- When the published list is empty the editor starts with up to three of the reader's own write relays, marked by the
  line `set.dmRelays.suggest`.
- `dm.setup.go` opens Settings on this entry.

Scenes: empty with suggestion, three relays unchanged, edited and unsaved.

## M5 Signers that ask

For an extension or remote-signer account, reading means one or two decrypt requests per message, and a signer that is
not set to always allow would ask each time.

- First open per account on this device: the tab shows `dm.ask` and the button `dm.ask.go` and opens no subscription.
  Pressing it is remembered under `lkjstr:dm-ok:<pubkey>`; later opens start at once. Local keys never see this.
- After one refused `crypt` request the interface answers every further request for that account with the same refusal
  without calling the signer, closes the private subscriptions, and the tab shows `dm.refused` with `dm.retry`. Retry
  clears that state and opens again. A page reload clears it too.
- A signer without NIP-44: `dm.signerOld` in place of the list.

Scenes: the question, refused.

## M6 New-message mark

Setting `set.dmWatch` with `set.dmWatch.d`, on by default. While it is on, the page is visible, the active account can
read (unlocked local key, or a signer account that passed M5 and has not refused), the frame keeps one
conversation-list subscription open. When its unread total is above 0:

- a vermilion dot at the top right of the account face in the top bar, `aria-label` `bar.unreadMessages`;
- in the account menu, after the reader's own row, a row `view.messages` with the vermilion count; it goes to the
  Messages tab as `goMessages` does.

No count on tab titles, no sound, no system notification in this batch.

## D1 Docs pages

Docs gets the page `docs.dm` with body `docs.dm.b`, after Keys and safety. The body of Keys and safety already carries
its new last section.
