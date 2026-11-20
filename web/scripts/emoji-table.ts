// The picker's Unicode table, made at build time from emojibase-data (MIT): every emoji up to Emoji 16.0 in its
// category, the English and Japanese names, a shortcode, the words to find it by in both languages (with the hand-written
// words of shared/emoji-data.ts), and five skin tones where Unicode has them. The app fetches it once, when first wanted.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GLYPHS } from '../src/shared/emoji-data.ts';
import { fold } from '../src/shared/emoji-find.ts';

/** Newest Emoji version offered: newer ones are still missing from common system fonts. */
const NEWEST = 16;
/** emojibase group number to the picker's category, in the picker's order. Group 2 (components) is not offered. */
const GROUPS: Readonly<Record<number, number>> = {
  0: 0,
  1: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
};

type Skin = { readonly emoji: string; readonly tone?: number | readonly number[] };
type Entry = {
  readonly hexcode: string;
  readonly emoji: string;
  readonly label: string;
  readonly tags?: readonly string[];
  readonly group?: number;
  readonly order?: number;
  readonly version: number;
  readonly skins?: readonly Skin[];
};
type Local = {
  readonly hexcode: string;
  readonly label: string;
  readonly tags?: readonly string[];
};

/** One row: [category, emoji, English name, Japanese name, shortcode, folded words, skins ('' or five, space-separated),
 * 1 when people react with it often]. */
export type TableRow = [number, string, string, string, string, string, string, 0 | 1];

const bare = (s: string): string => s.replace(/️/g, '');

export function emojiTable(require = createRequire(import.meta.url)): TableRow[] {
  const read = <T>(path: string): T => JSON.parse(readFileSync(require.resolve(path), 'utf8')) as T;
  const en = read<Entry[]>('emojibase-data/en/data.json');
  const ja = new Map(read<Local[]>('emojibase-data/ja/compact.json').map((e) => [e.hexcode, e]));
  const codes = (path: string): Map<string, readonly string[]> =>
    new Map(
      Object.entries(read<Record<string, string | string[]>>(path)).map(([k, v]) => [
        k,
        Array.isArray(v) ? v : [v],
      ]),
    );
  const github = codes('emojibase-data/en/shortcodes/github.json');
  const base = codes('emojibase-data/en/shortcodes/emojibase.json');
  const common = new Map(GLYPHS.map((g) => [bare(g.emoji), g.words]));
  return en
    .filter((e) => e.group !== undefined && GROUPS[e.group] !== undefined && e.version <= NEWEST)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e): TableRow => {
      const j = ja.get(e.hexcode);
      // The shortcode shown is the first word-like one ("thumbsup", not "+1"; "cat", not "cat2").
      const short = [...(base.get(e.hexcode) ?? []), ...(github.get(e.hexcode) ?? [])];
      const shown = short.find((c) => /^[a-z][a-z_]*$/.test(c)) ?? short[0] ?? '';
      const mine = common.get(bare(e.emoji));
      const words = new Set(
        fold(
          [e.label, ...(e.tags ?? []), j?.label ?? '', ...(j?.tags ?? []), ...short, mine ?? '']
            .join(' ')
            .replace(/[_:,]/g, ' '),
        )
          .split(/\s+/)
          .filter(Boolean),
      );
      // Skin tones: the five with one tone each, lightest first (a pair of people also has mixed ones, not offered).
      const skins = (e.skins ?? [])
        .filter((s): s is Skin & { tone: number } => typeof s.tone === 'number')
        .sort((a, b) => a.tone - b.tone)
        .map((s) => s.emoji);
      return [
        GROUPS[e.group ?? -1] ?? 0,
        e.emoji,
        e.label,
        j?.label ?? '',
        shown,
        [...words].join(' '),
        skins.length === 5 ? skins.join(' ') : '',
        mine === undefined ? 0 : 1,
      ];
    });
}

/** The table as the file the app fetches. */
export const emojiTableJson = (): string => JSON.stringify({ v: 1, rows: emojiTable() });
