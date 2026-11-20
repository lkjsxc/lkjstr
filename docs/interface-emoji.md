# Interface specification: emoji

## Purpose

One emoji picker for the composer, reactions and private messages, a preview of what is under the pointer, the
keyboard or a resting finger, and the same information over any emoji wherever one is drawn. Index and rules:
[interface-specs.md](interface-specs.md). The owner asked for the picker on 2026-11-20 (mail 1699) and for the
preview and the popover the same day (mail 1704), for every emoji (mail 1922). Engine side: [emoji-sets.md](emoji-sets.md).

## Shared rules

- One picker (`web/src/views/emoji-picker.ts`) serves every place; the place only decides what a pick does: insert
  into the composer, react to a note, insert into a private message.
- Every part has its size before anything is in it. The reader's sets arriving, the Unicode table arriving, the
  preview changing or a search narrowing the grid never move the panel, the search field, the categories or the
  grid's position on screen.
- Emoji are drawn by a colour emoji font before any text font: a system font with monochrome copies never wins.
- Pointer, keyboard and touch reach everything; no part needs a hover to be used.

## E1 The picker

Structure, top to bottom, in a floating panel under the button that opened it (above it when there is no room):

1. Search field and the skin tone button (an open hand in the chosen tone). Pressing the tone button puts six
   tones in the field's place as a radio group (`emoji.tone`, `emoji.tone0` to `emoji.tone5`); a choice puts the
   field back. The tone is kept on the device and applies to every emoji that has tones.
2. Categories (`emoji.cats`): a clock for frequently used, the custom tab (E4), then one emoji for each Unicode
   category (`emoji.cat0` to `emoji.cat8`). At rest they are grey; the one in view is in colour with the tab bar's
   indigo line. A press goes to that section, and empties a search first. The row scrolls sideways when it holds
   more than fits; it never grows with the reader's sets.
3. The grid: sections with a sticky quiet heading. Frequently used (`emoji.frequent`), then the custom tab's
   sub-groups (E4), then the nine Unicode categories. A search replaces the sections with the matches, best first:
   one unnamed list, or for a reader with custom emoji, two headed lists (E4).
4. The preview strip (E2).

Frequently used: the latest pick first, then the others by a count that halves every two weeks without a pick; at
most 16 shown, 48 kept on the device. A custom pick keeps its picture and set address, apart from the same code by
another picture.

Search: names, shortcodes and other words, in English and Japanese whatever the interface language; katakana and
hiragana, full and half width are the same. A whole word beats the start of one; a word found inside another counts
only for Japanese. The emoji's own name or shortcode, a common reaction, and the reader's own custom code lift a
match. A typed or pasted emoji is offered first, named when it is known. No match: `emoji.none`, centred.

Keyboard: the field has it on a mouse device; on touch the grid does, with no on-screen keyboard. Enter takes the
first match (the one the strip shows). Down enters the grid; the arrows walk it row by row across sections, Home and
End go to the ends, Up from the first row returns to the field. One cell takes Tab. Left and Right walk the
categories and the tones. Escape closes and gives the keyboard back to what opened it.

Pointer and touch: a press picks. A finger resting on a cell shows it in the strip and does not pick.

Data: the Unicode table (Emoji 16.0 and earlier, names in both languages, shortcodes, five tones) is built from the
pinned emojibase-data package into one hashed JSON file, fetched when the picker first opens (the offline shell
keeps it) and kept for the page's life; nothing is fetched for a reader who never opens the picker nor comes to an emoji in text. Until it
arrives, or if it cannot be had, the common reactions of `shared/emoji-data.ts` are offered. The reader's custom
emoji come from the engine's `emoji` source, which the open picker keeps visible; the last ones seen are drawn at
once on the next opening. Pictures load lazily, keep their cell, and a picture that fails shows its code in small type.

Picks: a Unicode pick is the glyph in the chosen tone. A custom pick puts `:code:` in the text and its tag
(`code`, `url`, and `address` when known) on the note draft or the reaction; a private draft keeps code and
picture only. A held reaction is told apart by emoji and picture.

## E2 The preview strip

A fixed band at the foot of the picker, 88 px tall under a hairline, that never takes a press. It shows one emoji
large (72 px; the owner asked for it large on 2026-11-20) with, beside it, its name in the interface language (the
Japanese name in Japanese, the English one otherwise) and its shortcode in faint type; for a custom emoji, its
`:code:` and its set (or `emoji.mine`). It describes, in order: the cell under the pointer, the cell a resting finger
holds, the cell with the keyboard, and while a search is typed, the first match. Otherwise it is empty and keeps its
height.

## E3 The emoji popover

Over an emoji in note text, a name, a profile or a reaction chip, custom or Unicode: the emoji at 72 px in a small
floating box above it (below it when there is no room). Beside a custom emoji, its `:code:`; beside a Unicode one,
its name in the interface language (the Japanese name when the table has one, the English one otherwise) and its
`:shortcode:` in faint type, as in the strip (E2). The owner asked for Unicode parity on 2026-11-20 (mail 1922).
It appears after a moment under the pointer, under a resting finger (whose press then neither opens the note nor
reacts), and at once while the keyboard is on it. An emoji standing alone (note text, a message, a bio, an act, a
notification's mark) is one tab stop; one inside a name, a quoted note or a button (a reaction, a mention, a
notification's excerpt) takes none of its own: that name, mention, reaction button or excerpt with the keyboard
shows the popover of its first emoji.
The popover takes no pointer events and closes on the next press, key, scroll or blur.
The emoji it describes have no tooltip of their own.

Unicode emoji are found in text one grapheme at a time, so a flag, a keycap, a toned emoji or a joined (ZWJ)
sequence is one emoji. Symbols that are text unless asked otherwise (copyright, arrows, the play sign) stay text
unless written with the emoji selector. Each emoji is an inline mark around its characters: text order, wrapping,
selection and copying are those of the text, and a press on one still opens its note. Names come from the same
Unicode table as the picker's, asked for when the pointer, a finger or the keyboard first comes to a Unicode emoji
(nothing is fetched before). Until it arrives, or when it cannot be had, the popover shows the emoji alone at once;
a name that arrives later is drawn only if the popover still shows that emoji.

Custom emoji pictures in text load ahead of the reader: a picture is asked for when its row comes within one and a
half tile heights of what the tile shows (a browser's own lazy loading waits inside a scrolling tile until it is in
view), so its width, or the code that replaces a failed one, settles out of sight; above the reading place the
anchor absorbs it. Until then it is a quiet box of the line's height.

## E4 The custom emoji tab

The owner asked for it on 2026-11-21 (overnight goal 1, mail 2188); Layout A of the Gemini design of 2026-11-20.

- One button in the row of categories, after the clock: two sparkles, named `emoji.custom`. It is there for every
  reader, so the help below can be found. It is lit while any of its sub-groups is in view, and a press (or Enter
  on it, after the arrows) goes to the first of them.
- Its sub-groups, in the engine's order, each under its own sticky heading: the reader's own list (`emoji.mine`,
  kind 10030 direct entries), then each set the list names (kind 30030, by title). A sub-group is kept apart by a
  stable key: `mine`, or `set:` and the set's address (its title only when the engine knows no address), so two sets
  with one title stay two. The keyboard walks them row by row like any section.
- Nothing yet (no list, or none cached): under the `emoji.custom` heading, one quiet line, `emoji.customHelp`. It is
  help, not a claim, so it stays true while a first opening is still asking for the sets; they replace it on arrival.
- Search stays global. For a reader with custom emoji the matches come in two headed lists, `emoji.custom` and
  `emoji.standard`; the list holding the best match goes first, so Enter and Down take the same emoji as before. A
  typed `:code` searches by shortcode, colons ignored. A reader with no custom emoji sees one unnamed list.
- Frequently used stays one list for both kinds (custom picks keep their picture and set). The strip (E2) shows a
  custom emoji at 72 px with its `:code:` and its set.
- Not built: browsing and adding sets seen on other people's notes. It needs an engine action that edits the
  reader's kind-10030 list; none exists ([emoji-sets.md](emoji-sets.md)), so the help line points elsewhere.

## Scenes

`pnpm shots -- --scenes=emoji-preview,emoji-search,emoji-tones,emoji-peek,emoji-peek-keys,emoji-reaction` and the
Unicode `emoji-peek-unicode`, `-unicode-name`, `-unicode-keys` and `-unicode-reaction` (in `web/`); E4 has
`emoji-custom`, `emoji-custom-search` and `emoji-custom-empty` (the mock's `emoji: 'none'`). Desktop points
with a mouse, and the `-keys` scenes use Tab; at 390 the scenes use touch and a long press.
Each scene checks what it shows: the grid does not move while the preview changes, the strip and the popover take no
press, and a long press neither picks, opens nor reacts. `pnpm smoke` adds the keyboard path through the picker, to the custom tab
and to a note's custom and Unicode emoji, a name and a mention, and that a press on either emoji still opens its note.
