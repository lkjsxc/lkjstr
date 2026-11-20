# Interface specification: threads

## Purpose

How a thread tab reads and how a reply is written in it. The owner asked on 2026-11-20 (mail 1838) for the thread
to look much better: the selected note as the clear focus, compact collapsible notes above it, replies that read as
a conversation, a reply field under the focus that keeps its draft, absolute dates, and honest, steady loading.
Index and rules: [interface-specs.md](interface-specs.md). The look is in [design.md](design.md).

## Shared rules

- The tab starts with its content: no heading, no explanatory text. Its title is the focused note's author.
- One avatar column runs the whole tab, as in Home: the same face, name, NIP-05 and action row.
- Every row has its height before what it waits for arrives: a note still being looked for holds the room of the
  row that will replace it, so nothing above the reader moves and the reading place (anchor plus offset) holds.
- Connectors are 2 px lines in `--sep`, in the avatar column, never deeper than one step: they say who answers
  whom, not how deep a conversation goes.
- Times in a thread are absolute with the date, `yyyy/mm/dd HH:mm`, unless relative time is set. In a tile under
  340 px the clock gives way first (the tooltip keeps both); a name always keeps some room.
- The interface arranges a thread and only a thread: it groups replies under the note they answer, keeping the
  engine's order among siblings. Paging still follows the engine's order.

## T1 The focused note

The note the tab was opened on. It is drawn whole: never folded, its text 1.5 px larger than a note's, its media at
full size, its action row and reaction chips as everywhere. No tint (the wash is the keyboard's). When it answers
something, the rail from the notes above ends in a short stub over its face. Until it is known, a focused-note
skeleton holds its place: a face, a name bar and three line bars in `--hold`, no motion. A note that cannot be
found is the quiet centred line of every list (`feed.empty`, `feed.failed`).

## T2 The notes above

What the focus answers, oldest first, joined by the rail. Each is compact: the face, the header line, and at most
two lines of text in `--muted` at 14 px, with a quiet mark for pictures or a quote; no action row, no media. Every
compact row has the same height, two text lines, so one that arrives replaces its placeholder without moving
anything. A press (or Enter) on a compact note opens it in place, whole, with its action row; a press on it then
opens its thread as anywhere. What was opened stays opened with the tab.

More than three notes above: the first (where the conversation began), one row `thread.earlier` ("{n} earlier
notes"), and the note the focus answers. Pressing it shows them all, and that stays with the tab.

Above the topmost note, while the note it answers is being looked for: a placeholder of the same height (a face and
two bars in `--hold`). When it has been asked for and has not come, the same room says `thread.missing` in
`--faint`, with a dashed face; if it comes later it takes that room. Additive engine field: `NoteRow.thread.parent`,
the id of the note a row answers, also when that note is unknown. Without it (an older engine) nothing is shown
above the topmost note, as before.

## T3 Replies

The conversation under the focus, each reply a note as in Home. A reply to the focus starts at the left. Everything
further down that branch is one step in (half the face and 14 px), joined to the reply it started from by a line down
the avatar column with a rounded elbow into each face; a reply that answers someone other than the branch's first
note says whom above its header, as Home says what a note answers: a reply arrow and that name in `--faint`. A
branch reads as one group: hairlines only between branches. The NIP-05 gives way before a name does.

A branch with more than three replies under its first shows two, then one row `thread.more` ("{n} more replies").
Pressing it shows the branch whole, and that stays with the tab.

While relays are still being asked and no reply has come, two reply skeletons hold room under the reply field;
they go when the first answer comes.

## T4 The reply field

Under the focused note, before the replies, a reply field (the composer of the Post tab, at channel size):
placeholder `thread.replyHint` ("Reply to {name}"), then, from the first time it has the keyboard (or holds a draft),
the bar with who is posting, emoji, media and `compose.reply`; the bar then stays, so leaving the field moves
nothing. A sent reply shows its progress on its own row in the thread; under the field only a failure stays,
with Retry, Edit and discard. Its draft, pictures and failed sends are the tab's own and come back
with it (reload, another layout, a closed tab reopened). Sending empties it and leaves the caret there; the reply
appears in the thread with the Sending mark. Read-only and signed out are said as in the Post tab.

Reply on the focus (the button or R) puts the keyboard in the field. Reply on any other note in the thread opens
that note's thread, right after this tab, with the keyboard in its field.

## States and scenes

`pnpm shots -- --scenes=thread,thread-long,thread-whole,thread-earlier,thread-wait,thread-missing,thread-reply` (in
`web/`, from the mock's `mock.threads` fixtures): an ordinary thread, a long thread on its focus and whole, its
earlier notes and one opened, a note above being looked for and then missing, and a reply being written. `pnpm smoke`
walks it by keyboard, keeps a draft through another tab, a reload and a reopened tab, and sends a reply.

Strings: `thread.earlier`, `thread.more`, `thread.missing`, `thread.looking`, `thread.replyHint`, `thread.answers`.
