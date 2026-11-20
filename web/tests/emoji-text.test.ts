import { describe, expect, it } from 'vitest';
import { emojiTable } from '../scripts/emoji-table.ts';
import { glyphsOf } from '../src/shared/emoji-find.ts';
import { glyphFor } from '../src/shared/emoji-table.ts';
import { emojiRuns, isEmojiGrapheme } from '../src/shared/emoji-text.ts';
import { reactionChips } from '../src/views/note-actions.ts';
import { segments, withEmoji } from '../src/views/parts.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const table = glyphsOf(JSON.parse(JSON.stringify({ v: 1, rows: emojiTable() })));
const emoji = (text: string): string[] =>
  emojiRuns(text).flatMap((r) => (typeof r === 'string' ? [] : [r.emoji]));
const holder = (children: unknown): HTMLElement => {
  const el = document.createElement('div');
  const add = (c: unknown): void => {
    if (Array.isArray(c)) for (const x of c) add(x);
    else if (c instanceof Node) el.append(c);
    else if (typeof c === 'string') el.append(c);
  };
  add(children);
  return el;
};

describe('Unicode emoji in text', () => {
  it('takes a flag, a keycap, a tone and a joined sequence as one emoji each', () => {
    const text = 'a🇯🇵b5️⃣c👍🏽d🙇‍♂️e👨‍👩‍👧f❤️‍🔥g🏴󠁧󠁢󠁥󠁮󠁧󠁿';
    expect(emoji(text)).toEqual(['🇯🇵', '5️⃣', '👍🏽', '🙇‍♂️', '👨‍👩‍👧', '❤️‍🔥', '🏴󠁧󠁢󠁥󠁮󠁧󠁿']);
    expect(
      emojiRuns(text)
        .map((r) => (typeof r === 'string' ? r : r.emoji))
        .join(''),
    ).toBe(text);
  });
  it('leaves text and text-style symbols alone, and marks a bare heart', () => {
    expect(emojiRuns('© 2026 lkjstr™ → 5 # ↩')).toEqual(['© 2026 lkjstr™ → 5 # ↩']);
    expect(emojiRuns('plain words, 日本語も')).toEqual(['plain words, 日本語も']);
    expect(emoji('↩️ ❤ ☺︎ ✌')).toEqual(['↩️', '❤', '✌']);
    expect(isEmojiGrapheme('🇯') || isEmojiGrapheme('a')).toBe(false);
  });
  it('finds each emoji as written in the table, toned or not, with or without its selector', () => {
    expect(glyphFor('👍🏽', table)).toMatchObject({
      glyph: { emoji: '👍', code: 'thumbsup' },
      tone: 3,
    });
    expect(glyphFor('❤', table)?.glyph.emoji).toBe('❤️');
    expect(glyphFor('🇯🇵', table)?.glyph.ja).toContain('日本');
    expect(glyphFor('🐱‍💻', table)).toBeUndefined();
    expect(glyphFor('👍')).toBeUndefined(); // the page's own table has not been asked for
  });
});

describe('Unicode emoji as drawn', () => {
  const env = {} as ViewEnv;
  it('note text marks each emoji, a tab stop when it stands alone, none inside a control', () => {
    const list = [{ k: 'text', text: 'おつかれさまです👍🏽 再接続も🇯🇵' }] as const;
    const alone = holder(segments(list, env));
    const marks = [...alone.querySelectorAll('.uemo')];
    expect(marks.map((m) => m.textContent)).toEqual(['👍🏽', '🇯🇵']);
    expect(marks.every((m) => m.getAttribute('tabindex') === '0')).toBe(true);
    expect(alone.textContent).toBe('おつかれさまです👍🏽 再接続も🇯🇵');
    const inside = holder(segments(list, env, true));
    expect(inside.querySelectorAll('.uemo[tabindex]')).toHaveLength(0);
  });
  it('a name marks its emoji beside its custom ones, and takes no tab stop', () => {
    const name = holder(
      withEmoji('山田 🦀 :neko:', [{ code: 'neko', url: 'https://a.test/n.png' }]),
    );
    expect(name.querySelector('.uemo')?.textContent).toBe('🦀');
    expect(name.querySelector('.uemo')?.hasAttribute('tabindex')).toBe(false);
    expect(name.querySelector('img.emo')).not.toBeNull();
  });
  it('a reaction chip holds its emoji as a mark with no tooltip; words keep theirs', () => {
    const row = {
      id: 'n1',
      reactions: [
        { emoji: '❤️‍🔥', count: 2, mine: false },
        { emoji: '草', count: 1, mine: false },
      ],
      counts: { partial: false },
    } as unknown as Parameters<typeof reactionChips>[0];
    const chips = [...(reactionChips(row, env)?.querySelectorAll('.rchip') ?? [])];
    expect(chips[0]?.querySelector('.uemo')?.textContent).toBe('❤️‍🔥');
    expect(chips[0]?.hasAttribute('title')).toBe(false);
    expect(chips[0]?.querySelector('.uemo[tabindex]')).toBeNull();
    expect(chips[1]?.getAttribute('title')).toBe('草');
  });
});
