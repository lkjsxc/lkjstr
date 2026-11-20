# Interface specification: emoji

## Purpose

One emoji picker for the composer, reactions and private messages, a preview of what is under the pointer, the
keyboard or a resting finger, and the same information over a custom emoji wherever one is drawn. Index and rules:
[interface-specs.md](interface-specs.md). The owner asked for the picker on 2026-11-20 (mail 1699) and for the
preview and the popover the same day (mail 1704). Engine side: [emoji-sets.md](emoji-sets.md).

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
2. Categories (`emoji.cats`): a clock for frequently used, the first picture of each of the reader's sets, then one
   emoji for each Unicode category (`emoji.cat0` to `emoji.cat8`). At rest they are grey; the one in view is in
   colour with the tab bar's indigo line. A press goes to that section, and empties a search first. The row
   scrolls sideways when it holds more than fits.
3. The grid: sections with a sticky quiet heading. Frequently used (`emoji.frequent`), then the reader's own list
   (`emoji.mine`, kind 10030 direct entries), then each set it names (kind 30030, by title), then the nine
   Unicode categories. A search replaces the sections with one unnamed list of matches, best first.
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
keeps it) and kept for the page's life; nothing is fetched for a reader who never opens the picker. Until it
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

## E3 The custom emoji popover

Over a custom emoji in note text, a name, a profile or a reaction chip: the same picture at 72 px with its `:code:`
beside it, in a small floating box above it (below it when there is no room). It appears after a moment under the pointer,
under a resting finger (whose press then neither opens the note nor reacts), and at once while the keyboard is on
it. A custom emoji standing alone (note text, a message, a bio, an act, a notification's mark) is one tab stop; one
inside a name, a quoted note or a reaction button takes none of its own, and a reaction button with the keyboard
shows its emoji's popover. The popover takes no pointer events and closes on the next press, key, scroll or blur.
The pictures it describes have no tooltip of their own. In text they load ahead of the reader: a picture is asked
for when its row comes within one and a half tile heights of what the tile shows (a browser's own lazy loading waits
inside a scrolling tile until it is in view), so its width, or the code that replaces a failed one, settles out of
sight; above the reading place the anchor absorbs it. Until then it is a quiet box of the line's height.

## Scenes

`pnpm shots -- --scenes=emoji-preview,emoji-search,emoji-tones,emoji-peek,emoji-peek-keys,emoji-reaction` (in
`web/`). Desktop points with a mouse, and `emoji-peek-keys` uses Tab; at 390 the scenes use touch and a long press.
Each scene checks what it shows: the grid does not move while the preview changes, the strip and the popover take no
press, and a long press neither picks, opens nor reacts. `pnpm smoke` adds the keyboard path through the picker and
to a note's custom emoji, and that a press on one still opens its note.
