# Interface specification: acts on acts

## Purpose

A reaction, a repost or a zap can be about another reaction or repost instead of a note: someone hearts the reader's
star, or reposts a reaction. Other clients draw these as a chain; here they were either dropped or drawn as if the
target were a note, with the raw reaction content as its excerpt. Index and rules:
[interface-specs.md](interface-specs.md). The owner asked for this on 2026-11-17: reactions to reactions and the like
must be shown as nostter and lumilumi show them.

## Shared rules

- An act is a kind 7 reaction, a kind 6 or 16 repost, or a zap receipt. Its target is the last `e` tag, as today.
- The chain is followed from the act to the first event that is not an act: that event is the note of the row. The
  engine follows at most four steps and requests a missing link by id as it does for a quoted note; the row is redrawn
  in place when it arrives.
- An act on an act never changes the counts, the chips or the heart of the note at the end of the chain. It counts
  only for the act it targets, and those counts are drawn nowhere yet.
- One additive shape carries a link of the chain (one line in `engine-proposals.md`, with the mock answer):
  `ActRef = { type: 'reaction' | 'repost'; actor: Author; emoji?: { emoji: string; url?: string } }`.
- An act chip is the emoji of a reaction drawn as the existing reaction chip without a number (a like is the heart,
  a custom emoji its image), or the existing repost icon at the same size, in `--muted`. No new colour or size.
- The notification toggles decide by the type of the newest act: a reaction to a reaction is a reaction.

## A1 Notification about the reader's reaction or repost

Additive: `NotificationRow.target.act?: ActRef`, present when the act was about the reader's own reaction or repost.
`target.id`, `target.excerpt` and `target.media` are then those of the note at the end of the chain, so a press still
opens its thread. The group key keeps the id of the act that was targeted: reactions to the reader's star and
reactions to the note itself are two rows.

- Headline: the actors as today, then the string for the pair below. The mark at the left is unchanged (the emoji of
  the new reaction, the repost icon, the zap icon).

| New act | On the reader's reaction | On the reader's repost |
| --- | --- | --- |
| reaction | `notif.reaction.onReaction` | `notif.reaction.onRepost` |
| repost | `notif.repost.onReaction` | `notif.repost.onRepost` |
| zap | `notif.zap` | `notif.zap` |

- Target line: the act chip of the reader's own act, a 6px gap, then the excerpt as today on the same line. The chip
  never wraps away from the excerpt; the excerpt truncates.
- The note is not on the device yet: the chip alone, followed by `act.note.pending` in `--muted`. A press then opens
  the first actor's profile, as a row without a target does today. When the note arrives the line is completed.
- The note cannot be found after the request ended: the chip and `act.note.missing` (not `quote.missing`: nothing
  here was quoted; judged on the A1 sheet of 2026-11-17, the rest of A1 stands as drawn).
- Fallback until the field exists: draw as today, but never draw a reaction's raw content (`+`, `:name:`) as an
  excerpt; an excerpt that is only that is treated as absent.

Scenes: `notif-act-reaction` (two actors, a custom emoji on the reader's star), `notif-act-repost`,
`notif-act-pending`, `notif-act-missing`.

## A2 A person's reaction or repost of an act, in their profile

The Reactions and Reposts tabs of a profile list the note at the end of the chain, once, at the time of the person's
act. Additive: `NoteRow.actOn?: ActRef`, the act the person acted on (its actor is someone else, or the person).

- A context line above the note, in the place and style of the reposted-by line: the person's own act chip, then
  `act.on.reaction` or `act.on.repost` with the name of `actOn.actor` as the usual name button, then that act's chip.
  One line; the name truncates first.
- The person acted both on the note and on an act about it: one row, with the context line.
- A chain longer than two acts shows only the act that was targeted; the rest is not drawn.
- A note that cannot be found is not listed, as today.
- Home, lists and search do not gain rows from this item.

Scenes: `profile-reactions-chain` (one ordinary reaction row, one reaction to a reaction, one reaction to a repost).

## Not in this batch

Reacting to or reposting an act from these lines, and showing who reacted to the reader's own reaction as a list.
They follow the actor lists of the next batch.
