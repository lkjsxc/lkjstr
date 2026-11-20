import { describe, expect, it } from 'vitest';
import { emojiTable } from '../scripts/emoji-table.ts';
import {
  fold,
  glyphBonus,
  glyphsOf,
  isEmoji,
  rank,
  toned,
  typedWords,
  wordFit,
} from '../src/shared/emoji-find.ts';
import { ordered, withPick } from '../src/shared/emoji-used.ts';
import { catOf } from '../src/views/emoji-grid.ts';
import { emojiTag } from '../src/views/emoji-picker.ts';
import { emojiSections, patched } from '../src/views/emoji-sections.ts';
import { withHeld } from '../src/views/held.ts';
import { withEmoji } from '../src/views/parts.ts';

const table = glyphsOf(JSON.parse(JSON.stringify({ v: 1, rows: emojiTable() })));
const find = (typed: string): string[] => {
  const words = typedWords(typed);
  return rank(
    table,
    words,
    (g) => g.words,
    (g) => glyphBonus(g, words),
  ).map((g) => g.emoji);
};

describe('the emoji table', () => {
  it('holds every category, both names and shortcodes, with no components', () => {
    expect(table.length).toBeGreaterThan(1800);
    expect(new Set(table.map((g) => g.cat))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    const joy = table.find((g) => g.emoji === '😂');
    expect(joy).toMatchObject({
      cat: 0,
      en: 'face with tears of joy',
      ja: '嬉し泣き',
      code: 'joy',
    });
    expect(table.some((g) => /^[\u{1F3FB}-\u{1F3FF}]$/u.test(g.emoji))).toBe(false);
  });
  it('offers five skin tones where Unicode has them, lightest first', () => {
    const wave = table.find((g) => g.emoji === '👋');
    expect(wave?.skins).toEqual(['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']);
    expect(wave && toned(wave, 3)).toBe('👋🏽');
    expect(wave && toned(wave, 0)).toBe('👋');
    const cat = table.find((g) => g.emoji === '🐱');
    expect(cat && toned(cat, 4)).toBe('🐱');
  });
});

describe('finding emoji', () => {
  it('folds case, width and kana', () => {
    expect(fold('ネコ')).toBe('ねこ');
    expect(fold('ＣＡＴ')).toBe('cat');
  });
  it('ranks whole words, then word starts, then insides', () => {
    expect(wordFit('cat face', 'cat')).toBe(3);
    expect(wordFit('category', 'cat')).toBe(2);
    expect(wordFit('wildcat', 'cat')).toBe(0);
    expect(wordFit('ねこのかお', 'かお')).toBe(1);
    expect(wordFit('dog', 'cat')).toBe(0);
  });
  it('finds by English, Japanese and shortcode, the common one first', () => {
    expect(find('ねこ')[0]).toBe('🐱');
    expect(find('ネコ')[0]).toBe('🐱');
    expect(find('cat')).toContain('🐈');
    expect(find(':joy:')[0]).toBe('😂');
    expect(find('嬉し泣き')[0]).toBe('😂');
    expect(find('thumbs up')[0]).toBe('👍');
    expect(find('いいね')[0]).toBe('👍');
    expect(find('zzzzqx')).toEqual([]);
  });
  it('knows a typed or pasted emoji', () => {
    expect(isEmoji('🫠') && isEmoji('👍🏽') && isEmoji('🇯🇵') && !isEmoji('ab')).toBe(true);
  });
});

describe('frequently used', () => {
  const day = 86_400_000;
  it('puts the latest first, then the most picked, older picks counting less', () => {
    let list = withPick([], { emoji: '🙏' }, 0);
    for (let i = 1; i <= 5; i++) list = withPick(list, { emoji: '🔥' }, i);
    list = withPick(list, { emoji: '🍵' }, 10);
    expect(list.map((u) => u.emoji)).toEqual(['🍵', '🔥', '🙏']);
    expect(list.find((u) => u.emoji === '🔥')?.n).toBe(5);
    // Two months on, one fresh pick outweighs five old ones.
    const later = withPick(list, { emoji: '🙏' }, 60 * day);
    expect(
      ordered(withPick(later, { emoji: '🍵' }, 60 * day + 1), 60 * day + 1).map((u) => u.emoji),
    ).toEqual(['🍵', '🙏', '🔥']);
  });
  it('keeps a custom emoji with its picture and set, apart from the same code by another picture', () => {
    const a = { emoji: ':neko:', url: 'https://a.test/neko.png', address: '30030:ab:cats' };
    const b = { emoji: ':neko:', url: 'https://b.test/neko.png' };
    const list = withPick(withPick([], a, 1), b, 2);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject(a);
  });
});

describe('custom emoji on what is sent', () => {
  it('a custom pick names its code, picture and set; a Unicode one names nothing', () => {
    expect(
      emojiTag({ emoji: ':neko:', url: 'https://a.test/n.png', address: '30030:ab:cats' }),
    ).toEqual({ code: 'neko', url: 'https://a.test/n.png', address: '30030:ab:cats' });
    expect(emojiTag({ emoji: ':neko:', url: 'https://a.test/n.png' })).toEqual({
      code: 'neko',
      url: 'https://a.test/n.png',
    });
    expect(emojiTag({ emoji: '🐱' })).toBeUndefined();
  });
  it('NIP-30 codes with hyphens and capitals are drawn', () => {
    const parts = withEmoji('hi :Blob-Cat_2:!', [
      { code: 'Blob-Cat_2', url: 'https://a.test/b.png' },
    ]);
    expect(parts.filter((p) => typeof p !== 'string')).toHaveLength(1);
  });
  it('a held reaction is told apart by its picture', async () => {
    const { hold, unhold } = await import('../src/views/held.ts');
    const row = {
      id: 'n9',
      reactions: [{ emoji: ':neko:', url: 'https://b.test/neko.png', count: 2, mine: false }],
      counts: { reactions: 2 },
    } as unknown as Parameters<typeof withHeld>[0];
    const what = { k: 'reaction', emoji: ':neko:', url: 'https://a.test/neko.png' } as const;
    hold(
      'n9',
      'me',
      what,
      () => new Promise(() => undefined),
      () => undefined,
    );
    const shown = withHeld(row);
    expect(shown.reactions).toHaveLength(2);
    expect(shown.reactions[0]).toMatchObject({ count: 2, mine: false });
    expect(shown.reactions[1]).toMatchObject({
      url: 'https://a.test/neko.png',
      count: 1,
      mine: true,
    });
    expect(unhold('n9', what)).toBe(true);
  });
});

describe('what the picker holds', () => {
  const row = (code: string, set: string, address?: string) =>
    ({
      kind: 'emoji',
      key: `emoji:${code}`,
      code,
      set,
      url: `https://e.test/${code}.png`,
      address,
    }) as const;
  const custom = [row('neko', ''), row('blob-cat', 'Cats', '30030:ab:cats'), row('kusa', '')];
  it('frequently used, then the custom tab by list and set, then the nine categories', () => {
    const list = emojiSections(custom, table, [{ emoji: '👋🏽' }], '');
    expect(list.map((s) => s.id)).toEqual([
      'used',
      'mine',
      'set:30030:ab:cats',
      ...Array.from({ length: 9 }, (_, i) => `cat:${i}`),
    ]);
    expect(list.map(catOf).slice(0, 4)).toEqual(['used', 'custom', 'custom', 'cat:0']);
    expect(list.slice(1, 3).map((s) => s.label)).toEqual(['Your emoji', 'Cats']);
    // A toned pick keeps its tone and still has its name.
    expect(list[0]?.items[0]?.glyph).toMatchObject({ emoji: '👋🏽', en: 'waving hand' });
    expect(list[1]?.items.map((i) => i.picked.emoji)).toEqual([':neko:', ':kusa:']);
    expect(list[2]?.items[0]?.picked).toMatchObject({
      emoji: ':blob-cat:',
      address: '30030:ab:cats',
    });
  });
  it('two sets with one title stay apart, each under its own address', () => {
    const twins = [row('a', 'Cats', '30030:ab:cats'), row('b', 'Cats', '30030:cd:cats')];
    const ids = emojiSections(twins, table, [], '').map((s) => s.id);
    expect(ids.slice(1, 3)).toEqual(['set:30030:ab:cats', 'set:30030:cd:cats']);
    // A direct entry naming a set of its own is still the reader's own list.
    const own = emojiSections([row('c', '', '30030:ab:cats')], table, [], '');
    expect(own[1]?.id).toBe('mine');
  });
  it('the custom tab with nothing in it says, in one line, how to get some', () => {
    const list = emojiSections([], table, [], '');
    expect(list[1]).toMatchObject({
      id: 'custom',
      cat: 'custom',
      label: 'Custom emoji',
      items: [],
    });
    expect(list[1]?.note).toMatch(/Nostr/);
  });
  it('typed words find custom and standard emoji under their headings, the best match first', () => {
    const [found, rest] = emojiSections(custom, table, [], 'neko');
    expect(found?.id).toBe('found:custom');
    expect(found?.items[0]?.picked.emoji).toBe(':neko:');
    expect(rest?.label).toBe('Standard emoji');
    const [cats, them] = emojiSections(custom, table, [], 'cat');
    expect(cats?.items.map((i) => i.picked.emoji).slice(0, 2)).toEqual(['🐱', '🐈']);
    expect(them?.items.map((i) => i.picked.emoji)).toEqual([':blob-cat:']);
    const [pasted] = emojiSections(custom, table, [], '🫨');
    expect(pasted?.items[0]?.glyph?.en).toBe('shaking face');
    const [unknown] = emojiSections(custom, table, [], '🐱‍🚀');
    expect(unknown?.items.map((i) => i.picked.emoji)).toEqual(['🐱‍🚀']);
    // Begun in the custom tab, a search puts the reader's matches first; a typed emoji still leads.
    expect(emojiSections(custom, table, [], 'cat', true)[0]?.id).toBe('found:custom');
    expect(emojiSections(custom, table, [], '🫨', true)[0]?.id).toBe('found:standard');
    expect(emojiSections(custom, table, [], 'smile', true)[0]?.id).toBe('found:standard');
    // A reader with no custom emoji sees one unnamed list, as before.
    const plain = emojiSections([], table, [], 'cat');
    expect(plain.map((s) => s.label)).toEqual(['']);
  });
  it('a patch of the engine adds, changes and removes custom emoji in place', () => {
    const next = patched(custom, [
      { op: 'insert', before: 'emoji:kusa', rows: [row('ok', '')] },
      { op: 'update', row: row('neko', 'Cats') },
      { op: 'remove', key: 'emoji:blob-cat' },
    ]);
    expect(next.map((r) => `${r.code}/${r.set}`)).toEqual(['neko/Cats', 'ok/', 'kusa/']);
  });
});
