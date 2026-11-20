// The Unicode table, fetched once from the hashed file the build wrote, and kept for the page's life. It is asked for
// when the picker first opens (frequently used and the reader's own emoji draw before it; the offline shell keeps the
// file, so it comes from the device), or when the pointer, a finger or the keyboard first comes to an emoji in text,
// whose popover names it. Nothing is done for it before that: a reader who does neither pays nothing. Without it (a
// failed fetch) the picker offers the common emoji of emoji-data.ts and the popover shows the emoji without a name.
import { GLYPHS } from './emoji-data.ts';
import { fold, type Glyph, glyphsOf } from './emoji-find.ts';
import { emojiKey } from './emoji-text.ts';

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

export type Known = { readonly glyph: Glyph; readonly tone: number };
/** Bound: one index per table, which lives for the page. */
const indexes = new WeakMap<readonly Glyph[], Map<string, Known>>();

/** What the table knows of an emoji as written: a toned one is its glyph and tone. Undefined until the table has
 * arrived (this does not ask for it), and for an emoji the table does not hold. */
export function glyphFor(emoji: string, list = table): Known | undefined {
  if (!list) return undefined;
  let index = indexes.get(list);
  if (!index) {
    index = new Map();
    for (const glyph of list) {
      glyph.skins?.forEach((skin, i) => index?.set(emojiKey(skin), { glyph, tone: i + 1 }));
      index.set(emojiKey(glyph.emoji), { glyph, tone: 0 });
    }
    indexes.set(list, index);
  }
  return index.get(emojiKey(emoji));
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
