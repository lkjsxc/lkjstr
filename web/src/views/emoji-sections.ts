// What the picker's grid holds: frequently used, then the reader's custom emoji set by set, then the Unicode
// categories; or, once something is typed, everything that matches it, best first. Tested.
import type { EmojiRow, PatchOp, Row } from '../engine/protocol.ts';
import {
  customBonus,
  fold,
  type Glyph,
  glyphBonus,
  isEmoji,
  rank,
  typedWords,
} from '../shared/emoji-find.ts';
import { COMMON } from '../shared/emoji-table.ts';
import type { Picked } from '../shared/emoji-used.ts';
import { type Key, t } from '../shared/i18n.ts';
import type { Section } from './emoji-grid.ts';
import type { Item } from './emoji-preview.ts';

/** What each Unicode category shows in the row of categories. */
export const CAT_ICONS = ['😀', '👋', '🐱', '🍙', '🚃', '⚽', '💡', '❤️', '🏁'];

const bare = (s: string): string => s.replace(/️/g, '');
const lookups = new WeakMap<readonly Glyph[], Map<string, Glyph>>();
/** Each emoji of the table, and each of its toned forms, to its entry (a toned form keeps its tone). */
function lookup(table: readonly Glyph[]): Map<string, Glyph> {
  const known = lookups.get(table);
  if (known) return known;
  const by = new Map<string, Glyph>();
  for (const g of table) {
    by.set(bare(g.emoji), g);
    for (const s of g.skins ?? []) by.set(bare(s), { ...g, emoji: s, skins: undefined });
  }
  lookups.set(table, by);
  return by;
}

/** The custom emoji rows after a patch of the engine. */
export function patched(rows: readonly EmojiRow[], ops: readonly PatchOp[]): EmojiRow[] {
  let out = [...rows];
  const mine = (r: Row): r is EmojiRow => r.kind === 'emoji';
  for (const op of ops) {
    if (op.op === 'remove') out = out.filter((r) => r.key !== op.key);
    else if (op.op === 'update' && mine(op.row)) {
      const row = op.row;
      out = out.map((r) => (r.key === row.key ? row : r));
    } else if (op.op === 'insert') {
      const at = op.before === null ? -1 : out.findIndex((r) => r.key === op.before);
      out.splice(at < 0 ? out.length : at, 0, ...op.rows.filter(mine));
    }
  }
  return out;
}

/** A custom emoji is found by its code, the parts of its code and its set's name. */
const customWords = (it: Item): string => {
  const code = it.picked.emoji.slice(1, -1);
  return fold(`${code} ${code.replace(/[-_]/g, ' ')} ${it.set ?? ''}`);
};
const glyphItem = (g: Glyph): Item => ({ picked: { emoji: g.emoji }, glyph: g });

export function emojiSections(
  custom: readonly EmojiRow[],
  table: readonly Glyph[] | undefined,
  used: readonly Picked[],
  typed: string,
): Section[] {
  const by = table ? lookup(table) : undefined;
  const mine = custom.map(
    (r): Item => ({
      picked: { emoji: `:${r.code}:`, url: r.url, ...(r.address ? { address: r.address } : {}) },
      set: r.set,
    }),
  );
  const words = typedWords(typed);
  if (words.length) {
    const found = rank(
      [...mine, ...(table ?? COMMON).map(glyphItem)],
      words,
      (it) => it.glyph?.words ?? customWords(it),
      (it) =>
        it.glyph ? glyphBonus(it.glyph, words) : customBonus(it.picked.emoji.slice(1, -1), words),
    );
    // A typed or pasted emoji is itself the first choice, with its name when the table knows it.
    const known = isEmoji(typed) ? by?.get(bare(typed)) : undefined;
    const raw: Item[] = known
      ? [glyphItem(known)]
      : isEmoji(typed)
        ? [{ picked: { emoji: typed } }]
        : [];
    return [{ id: 'found', label: '', items: [...raw, ...found] }];
  }
  const sets = new Map<string, Item[]>();
  for (const it of mine) sets.set(it.set ?? '', [...(sets.get(it.set ?? '') ?? []), it]);
  return [
    {
      id: 'used',
      label: t('emoji.frequent'),
      items: used.map((p): Item => {
        if (!p.url) return { picked: p, glyph: by?.get(bare(p.emoji)) };
        return (
          mine.find((m) => m.picked.emoji === p.emoji && m.picked.url === p.url) ?? { picked: p }
        );
      }),
    },
    ...[...sets].map(([set, items]) => ({
      id: `set:${set}`,
      label: set || t('emoji.mine'),
      items,
    })),
    ...(table
      ? CAT_ICONS.map((_, c) => ({
          id: `cat:${c}`,
          label: t(`emoji.cat${c}` as Key),
          items: table.filter((g) => g.cat === c).map(glyphItem),
        }))
      : [{ id: 'common', label: '', items: COMMON.map(glyphItem) }]),
  ];
}
