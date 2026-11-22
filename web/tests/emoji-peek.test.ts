import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Glyph } from '../src/shared/emoji-find.ts';

// The table is held back until a test lets it arrive, or fail.
const state = vi.hoisted(() => ({
  table: undefined as readonly Glyph[] | undefined,
  arrive: undefined as ((ok: boolean) => void) | undefined,
}));
vi.mock('../src/shared/emoji-table.ts', () => {
  const glyphs: Glyph[] = [
    { emoji: '🦀', cat: 3, en: 'crab', ja: 'カニ', code: 'crab', words: '', common: false },
    {
      emoji: '👍',
      cat: 1,
      en: 'thumbs up',
      ja: 'サムズアップ',
      code: 'thumbsup',
      words: '',
      skins: ['👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿'],
      common: true,
    },
  ];
  return {
    emojiTableNow: () => state.table,
    emojiTable: () =>
      new Promise((done) => {
        state.arrive = (ok) => {
          if (ok) state.table = glyphs;
          done(state.table ?? []);
        };
      }),
    glyphFor: (emoji: string) => {
      if (!state.table) return undefined;
      for (const glyph of state.table) {
        if (glyph.emoji === emoji) return { glyph, tone: 0 };
        const tone = glyph.skins?.indexOf(emoji) ?? -1;
        if (tone >= 0) return { glyph, tone: tone + 1 };
      }
      return undefined;
    },
  };
});

const { installEmojiPeek } = await import('../src/views/emoji-peek.ts');
const { setLang } = await import('../src/shared/i18n.ts');

const layer = document.createElement('div');
const mark = (text: string): HTMLElement => {
  const el = document.createElement('span');
  el.className = 'uemo';
  el.textContent = text;
  document.body.append(el);
  return el;
};
const point = (el: Element): void =>
  void el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
const peek = (): Element | null => layer.querySelector('.epeek');

beforeAll(() => {
  document.body.append(layer);
  installEmojiPeek(layer);
  vi.useFakeTimers();
});
afterAll(() => vi.useRealTimers());

describe('incoming custom emoji provenance', () => {
  it('shows the exact known set label, and otherwise the picture host', () => {
    setLang('en');
    for (const set of ['Known set', undefined]) {
      const image = document.createElement('img');
      image.className = 'emo';
      image.alt = ':pien:';
      image.src = 'https://pictures.test/pien.png';
      if (set) {
        image.dataset.emojiAddress = '30030:' + 'a'.repeat(64) + ':set';
        image.dataset.emojiSet = set;
      }
      document.body.append(image);
      point(image);
      vi.advanceTimersByTime(300);
      expect(peek()?.querySelector('.ename')?.textContent).toBe(':pien:');
      expect(peek()?.querySelector('.ecode')?.textContent).toBe(set ?? 'from pictures.test');
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      image.remove();
    }
  });
});

describe('the popover over a Unicode emoji', () => {
  it('shows the emoji at once, and its name when the table comes, in the reader language', async () => {
    setLang('ja');
    const crab = mark('🦀');
    point(crab);
    vi.advanceTimersByTime(299);
    expect(peek()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(peek()?.querySelector('.ebig')?.textContent).toBe('🦀');
    expect(peek()?.querySelector('.ename')?.textContent).toBe('');
    state.arrive?.(true);
    await vi.runAllTimersAsync();
    expect(peek()?.querySelector('.ename')?.textContent).toBe('カニ');
    expect(peek()?.querySelector('.ecode')?.textContent).toBe(':crab:');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(peek()).toBeNull();
  });
  it('names a toned emoji by its glyph and keeps its tone; English has the English name', () => {
    setLang('en');
    const thumbs = mark('👍🏽');
    point(thumbs);
    vi.advanceTimersByTime(300);
    expect(peek()?.querySelector('.ebig')?.textContent).toBe('👍🏽');
    expect(peek()?.querySelector('.ename')?.textContent).toBe('Thumbs up');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  it('a late table never names an emoji the popover has left; a failed one leaves it unnamed', async () => {
    state.table = undefined;
    const first = mark('🦀');
    const second = mark('🐱‍💻');
    point(first);
    vi.advanceTimersByTime(300);
    const waiting = state.arrive;
    point(second);
    vi.advanceTimersByTime(300);
    expect(peek()?.querySelector('.ebig')?.textContent).toBe('🐱‍💻');
    waiting?.(true);
    await vi.runAllTimersAsync();
    expect(peek()?.querySelector('.ebig')?.textContent).toBe('🐱‍💻');
    expect(peek()?.querySelector('.ename')?.textContent).toBe('');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    state.table = undefined;
    point(first);
    vi.advanceTimersByTime(300);
    state.arrive?.(false);
    await vi.runAllTimersAsync();
    expect(peek()?.querySelector('.ebig')?.textContent).toBe('🦀');
    expect(peek()?.querySelector('.ename')?.textContent).toBe('');
  });
  it('a name, a mention or an excerpt with the keyboard shows its emoji, which has no tab stop', () => {
    state.table = undefined;
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    for (const cls of ['name', 'lnk', 'excerpt']) {
      const button = document.createElement('button');
      button.className = cls;
      button.append('山田 ', mark('🦀'));
      document.body.append(button);
      const visible = vi.spyOn(button, 'matches').mockImplementation((q) => q === ':focus-visible');
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(peek()?.querySelector('.ebig')?.textContent).toBe('🦀');
      expect(button.querySelector('[tabindex]')).toBeNull();
      visible.mockRestore();
      button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      expect(peek()).toBeNull();
    }
  });
});
