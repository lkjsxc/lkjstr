# Interface specification: notes that are not shown, and why

## Purpose

The owner asked on 2026-11-21 (#2803, #2804) that lkjstr be open about every note it hides: one quiet line where the
note would be, saying why, with the reason's own setting one press away, a safe way to show it when it can be shown,
and plain facts when it cannot. Content warnings stay ordinary rows. Index and rules:
[interface-specs.md](interface-specs.md). The look is in [design.md](design.md).

## H1 The hidden line

- A note that would be a row but is hidden for a reason keeps its slot: one line, at the place and key of the note, in
  `--faint` at 12.5px, never a second row. It has no face, no name and no body. For a muted person even the name stays
  away.
- The line is `hidden.<reason>`, then `Why` and, when the note can be shown, `Show`:

| Reason | Line (EN) | Show |
| --- | --- | --- |
| `muted-person` | From someone you muted. | yes |
| `muted-thread` | In a thread you muted. | yes |
| `muted-word` | Has a word you muted. | yes |
| `muted-hashtag` | Has a hashtag you muted. | yes |
| `repeated-content` | Repeats a note already shown. | yes |
| `author-limit` | One of many notes from this person in this list. | yes |
| `machine-payload` | Looks like machine data, not a post. | yes |
| `language` | In another language. | yes |
| `deleted` | Deleted by its author. | never |
| `expired` | Past the end time its author set. | never |
| anything else | Hidden. | as the engine says |

- In a thread the same line holds the room of a hidden reply or note above the focus. The thread's rail goes on
  through it.
- `Why` and `Show` are buttons of at least 32px touch height, through padding with no change to the line's height.
  They are reached by Tab, and j and k pass over the line as over a divider.

## H2 Why

- `Why` opens a short detail under the line, inline (no popover; `aria-expanded` on the button), and closes the same
  way. It says what happened in one sentence and offers the reason's own setting where one exists:
  - muted person, word, hashtag or thread: the matching mute list, opened at its entry
    (`env.open('settings', { at: 'set.mute.person' | 'set.mute.word' | 'set.mute.hashtag' | 'set.mute.thread' })`).
    For a word or hashtag it names the matching entry when the engine says which;
  - language: the reading language setting;
  - repeated content and author limit apply only to a visitor's Global (the engine's signed-out filter,
    `signedOutGlobalFilter`, on by default). Why says so and opens the setting this slice adds for it,
    `set.visitorFilter` ("Reading: While signed out, fold repeats and floods in Global"). Off, Global shows them as
    rows;
  - machine payload: only the fact, with no setting;
  - deleted: "Its author asked for it to be deleted. It cannot be shown." Nothing else;
  - expired: "Its author set it to expire. It cannot be shown." Nothing else.
- Opening Why asks nothing of the engine. It reads what the row already carries.

## H3 Show and hide again

- `Show` asks the engine to show this one note in this list (`note.reveal`). The engine puts the verified original in
  the same slot. Above it, a quiet context line `hidden.shown` ("Shown. {reason}") with `Hide` puts the
  line back. Nothing else in the list changes, and the reading place holds.
- A note the engine cannot show (deleted, no verified copy kept) has no `Show`, and Why says so as a fact.
- The choice is remembered with the tab for that note. When the row comes back (scrolling, a reload), the interface
  asks to show it again. Only notes the reader showed are asked for.

## H4 What has no row

Events that never became a trustworthy row are not drawn as rows. The engine reports them per list as evidence with a
cause. One quiet line at the end of the list names each reported cause, in this order, and nothing is drawn when
nothing is reported:

| Cause | Line (EN) | Count |
| --- | --- | --- |
| `invalid` | Dropped {n} relay deliveries that failed signature or content checks. | deliveries seen, when exact |
| `pruned` | Older notes were cleared from this device to save room. | none |
| `undelivered` | Some relays did not deliver everything asked for. | none |
| `unavailable-repost` | {n} reposts point to notes that are not available. | when exact |

A number appears only when the engine marks it exact, and it counts what was observed (deliveries, reposts), never
notes that were not seen; otherwise the line says "some". "Could not be verified" is used only for failed checks,
never for the cache or for relays that did not deliver. These lines have no Show and no switch. Invalid, deleted and
expired bodies are never shown.

## H5 Content warnings (NIP-36)

A note with a content warning is an ordinary row: face, name, time, via, action row and reaction chips as always. Only
its text, pictures, media, quoted notes and link cards fold behind `note.cw` ("Content warning: {reason}") with
`Show`, inline, the same in threads, where a compact note above the focus shows the warning in place of its two
lines. Nothing behind the warning is fetched or drawn before Show: no pictures, media or link previews. Shown, the
warning stays as a quiet line above the body with `Hide`. The choice is kept with the tab for that
note, and `set.showSensitive` opens them all.

## Engine needs (additive; one line each in [engine-proposals.md](engine-proposals.md))

- `NoteRow.hidden: { reason, revealable, detail? }` on the row of the would-be note, same `key` and `id`, with no body,
  counts or controls. It keeps only the verified author (not drawn), time and thread place. `detail` is the reader's
  own matching mute entry for a word or hashtag, bounded.
- Action `{ a: 'note.reveal', sub, key, reveal }`. With `reveal: true` the same slot gets the verified original row
  carrying `revealed: { reason }`; with `false` it is hidden again. It is scoped to that subscription and idempotent.
- `SubState.unshown?: { reason: 'invalid' | 'pruned' | 'undelivered' | 'unavailable-repost'; count?; exact }[]`,
  per list; `invalid` counts invalid deliveries observed, `undelivered` has no count, `pruned` only from attributed
  retention evidence.
- Reasons with a setting: the four mutes (`set.mute.*`), and repeated content and author limit through
  `signedOutGlobalFilter` (the existing wire configuration, now a setting). `language` is a reason only the mock still sends;
  the real Worker filters language as a query.

## Acceptance

Synthetic loopback fixtures, desktop 1440 and phone 390, both languages:

- each reason's line and Why, with its setting link opening the right entry;
- Show and Hide in place, with the reading place held;
- no Show for deleted;
- a reload keeps a shown note shown;
- the line keeps the slot's height;
- keyboard and touch work;
- a content-warned note keeps its header, actions and chips, with its body folded, also in a thread;
- the end line appears only when reported, with a number only when it is exact.
