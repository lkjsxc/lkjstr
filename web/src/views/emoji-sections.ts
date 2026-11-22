// What the picker's grid holds: frequently used, then the custom emoji tab (the reader's own list and each set it
// names, or one line on how to get some), then the Unicode categories; or, once something is typed, everything that
// matches it, best first, custom and standard emoji under their own headings for a reader who has custom ones. Tested.
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

/** The category of every custom sub-group: one tab in the row of categories. */
export const CUSTOM = 'custom';
/** Membership source is independent of the title and of an image tag's provenance. */
const groupOf = (r: EmojiRow): string => r.source;

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

function collisionLabels(items: readonly Item[]): Item[] {
  const label = (item: Item): string =>
    item.picked.source?.startsWith('10030:') ? t('emoji.mine') : (item.set ?? '');
  return items.map((item) => {
    const peers = items.filter(
      (other) => other !== item && !!other.picked.url && other.picked.emoji === item.picked.emoji,
    );
    if (!item.picked.url || !peers.length) return item;
    let caption = label(item);
    if (peers.some((other) => label(other) === caption)) {
      const identifier = item.picked.source?.split(':').slice(2).join(':');
      if (identifier) caption += ` · ${identifier}`;
    }
    return { ...item, sourceLabel: caption, set: caption };
  });
}

export function emojiSections(
  custom: readonly EmojiRow[],
  table: readonly Glyph[] | undefined,
  used: readonly Picked[],
  typed: string,
  /** The search began in the custom tab: its matches lead, unless an emoji itself was typed. */
  customFirst = false,
): Section[] {
  const by = table ? lookup(table) : undefined;
  const mine: Item[] = [];
  const sets = new Map<string, { id: string; cat: string; label: string; items: Item[] }>();
  for (const r of custom) {
    const own = r.source.startsWith('10030:');
    const set = own ? '' : r.set || undefined;
    const it: Item = {
      picked: {
        emoji: `:${r.code}:`,
        url: r.url,
        source: r.source,
        set,
        ...(r.address ? { address: r.address } : {}),
      },
      set,
    };
    mine.push(it);
    const id = groupOf(r);
    const known = sets.get(id);
    if (known) known.items.push(it);
    else sets.set(id, { id, cat: CUSTOM, label: own ? t('emoji.mine') : r.set, items: [it] });
  }
  const words = typedWords(typed);
  if (words.length) {
    const first = new Map<string, Item>();
    const searchWords = new Map<Item, string>();
    for (const item of mine) {
      const key = JSON.stringify([item.picked.emoji, item.picked.url]);
      const chosen = first.get(key) ?? item;
      first.set(key, chosen);
      searchWords.set(chosen, `${searchWords.get(chosen) ?? ''} ${customWords(item)}`);
    }
    const distinct = [...first.values()];
    const found = rank(
      [...distinct, ...(table ?? COMMON).map(glyphItem)],
      words,
      (it) => it.glyph?.words ?? searchWords.get(it) ?? customWords(it),
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
    if (!mine.length) return [{ id: 'found', label: '', items: [...raw, ...found] }];
    const matches = collisionLabels(found.filter((it) => !it.glyph));
    const groups: Section[] = [
      { id: 'found:custom', cat: CUSTOM, label: t('emoji.custom'), items: matches },
      {
        id: 'found:standard',
        label: t('emoji.standard'),
        items: [...raw, ...found.filter((it) => it.glyph)],
      },
    ];
    // Elsewhere the heading of the best match comes first, so Enter and Down take what they always took.
    const lead = !raw.length && ((customFirst && matches.length > 0) || !found[0]?.glyph);
    return lead ? groups : groups.reverse();
  }
  return [
    {
      id: 'used',
      label: t('emoji.frequent'),
      items: collisionLabels(
        used.map((p): Item => {
          if (!p.url) return { picked: p, glyph: by?.get(bare(p.emoji)) };
          return (
            mine.find(
              (m) =>
                m.picked.emoji === p.emoji &&
                m.picked.url === p.url &&
                m.picked.source === p.source,
            ) ?? { picked: p, set: p.set }
          );
        }),
      ),
    },
    ...(sets.size
      ? sets.values()
      : [
          {
            id: CUSTOM,
            cat: CUSTOM,
            label: t('emoji.custom'),
            items: [],
            note: t('emoji.customHelp'),
          },
        ]),
    ...(table
      ? CAT_ICONS.map((_, c) => ({
          id: `cat:${c}`,
          label: t(`emoji.cat${c}` as Key),
          items: table.filter((g) => g.cat === c).map(glyphItem),
        }))
      : [{ id: 'common', label: '', items: COMMON.map(glyphItem) }]),
  ];
}
