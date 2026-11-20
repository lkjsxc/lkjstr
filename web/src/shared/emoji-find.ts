// Finding emoji by what was typed: names, shortcodes and other words, in English and Japanese, for the Unicode table
// and the reader's custom emoji alike. Pure, tested.

/** Lower case, full-width letters made plain, katakana as hiragana: "ネコ" and "ねこ", "Ｃａｔ" and "cat" are one. */
export const fold = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** One Unicode emoji of the table. */
export type Glyph = {
  readonly emoji: string;
  /** Category index (see CATEGORIES in the picker). */
  readonly cat: number;
  readonly en: string;
  readonly ja: string;
  /** A shortcode without colons ('' when there is none). */
  readonly code: string;
  /** Folded words, space-separated. */
  readonly words: string;
  /** The five skin tones, lightest first, when Unicode has them. */
  readonly skins?: readonly string[];
  /** People react with it often: it goes first among equal matches. */
  readonly common: boolean;
};

type Row = readonly [number, string, string, string, string, string, string, number];
/** The fetched table's rows as glyphs; anything malformed is left out. */
export function glyphsOf(data: unknown): Glyph[] {
  const rows = (data as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Row => Array.isArray(r) && r.length === 8 && typeof r[1] === 'string')
    .map(([cat, emoji, en, ja, code, words, skins, common]) => ({
      emoji,
      cat,
      en,
      ja,
      code,
      words,
      skins: skins ? skins.split(' ') : undefined,
      common: common === 1,
    }));
}

/** How well one typed word fits a word list: 3 a whole word, 2 the start of one, 1 inside one, 0 not at all. Inside
 * counts only for Japanese and other scripts written without spaces: "cat" is not found in "education". */
export function wordFit(words: string, typed: string): number {
  const spaced = ` ${words} `;
  if (spaced.includes(` ${typed} `)) return 3;
  if (spaced.includes(` ${typed}`)) return 2;
  return !/^[\x20-\x7e]+$/.test(typed) && words.includes(typed) ? 1 : 0;
}

/** What was typed, as folded words; colons of a typed `:code:` do not count. */
export const typedWords = (typed: string): string[] =>
  fold(typed).replace(/:/g, ' ').split(/\s+/).filter(Boolean);

/** Every candidate that has all the typed words, best first; equal ones keep their order. `bonus` lifts some, when
 * each typed word is a word of theirs or starts one. */
export function rank<T>(
  list: readonly T[],
  typed: readonly string[],
  words: (x: T) => string,
  bonus: (x: T) => number = () => 0,
): T[] {
  if (!typed.length) return [...list];
  const scored: { x: T; s: number; i: number }[] = [];
  list.forEach((x, i) => {
    const w = words(x);
    let s = 0;
    let inside = false;
    for (const t of typed) {
      const f = wordFit(w, t);
      if (!f) return;
      s += f;
      inside ||= f === 1;
    }
    // A word found only inside another ("cat" in "communication") earns no lift.
    scored.push({ x, s: s + (inside ? 0 : bonus(x)), i });
  });
  return scored.sort((a, b) => b.s - a.s || a.i - b.i).map((e) => e.x);
}

/** What lifts a glyph among equal matches: the typed words are its very name or shortcode; people use it often. */
export function glyphBonus(g: Glyph, typed: readonly string[]): number {
  const all = typed.join(' ');
  const named = all === g.code.replace(/_/g, ' ') || all === fold(g.en) || all === fold(g.ja);
  return (named ? 2 : 0) + (g.common ? 2.5 : 0);
}
/** A custom emoji goes before Unicode ones it ties with, and its very code before everything. */
export const customBonus = (code: string, typed: readonly string[]): number =>
  typed.join(' ') === fold(code) ? 3.75 : 0.75;

/** Whether the text is itself one emoji (typed or pasted): it can be used although it is not in the table. */
export const isEmoji = (text: string): boolean =>
  /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*$/u.test(text) ||
  /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(text);

/** The glyph in the chosen tone (0 none, 1 to 5 light to dark). */
export const toned = (g: Glyph, tone: number): string =>
  (tone > 0 && g.skins?.[tone - 1]) || g.emoji;
