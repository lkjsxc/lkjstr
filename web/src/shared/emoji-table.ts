// The Unicode table, fetched once from the hashed file the build wrote, and kept for the page's life. It is asked for
// when the picker first opens (frequently used and the reader's own emoji draw before it; the offline shell keeps the
// file, so it comes from the device). Nothing is done for it before that: a reader who never opens the picker pays
// nothing. Without it (a failed fetch) the picker offers the common emoji of emoji-data.ts.
import { GLYPHS } from './emoji-data.ts';
import { fold, type Glyph, glyphsOf } from './emoji-find.ts';

let table: readonly Glyph[] | undefined;
let asked: Promise<readonly Glyph[]> | undefined;

export const COMMON: readonly Glyph[] = GLYPHS.map((g) => ({
  emoji: g.emoji,
  cat: -1,
  en: '',
  ja: '',
  code: '',
  words: fold(g.words),
  common: true,
}));

/** The table if it has arrived; otherwise undefined (and it is asked for). */
export function emojiTableNow(): readonly Glyph[] | undefined {
  if (!table) void emojiTable();
  return table;
}

export function emojiTable(): Promise<readonly Glyph[]> {
  asked ??= (
    __EMOJI_URL__
      ? fetch(__EMOJI_URL__)
          .then((r) => (r.ok ? r.json() : undefined))
          .then(glyphsOf)
      : Promise.resolve([])
  )
    .catch(() => [] as Glyph[])
    .then((list) => {
      if (list.length) table = list;
      else asked = undefined; // try again next time
      return list.length ? list : COMMON;
    });
  return asked;
}
