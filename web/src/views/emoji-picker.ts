// The emoji picker: a small panel under the button that opened it. Recently used first, then the account's custom
// emoji (NIP-30, from the engine), then the common Unicode ones. Typing narrows all of them, in either language;
// Enter takes the first, the arrows walk the grid.
import type { EmojiRow, Row } from '../engine/protocol.ts';
import { findGlyphs, isEmoji } from '../shared/emoji-data.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { kv } from '../shared/storage.ts';
import { openPopover } from '../wm/menus.ts';
import type { ViewEnv } from './registry.ts';

/** A Unicode emoji, or `:code:` with the `url` of its picture. */
export type Picked = { readonly emoji: string; readonly url?: string };
const RECENT = 'emoji:recent';
const KEEP = 16;

export function recentEmoji(): Picked[] {
  const v = kv.get(RECENT);
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Picked => typeof x?.emoji === 'string').slice(0, KEEP);
}
/** The latest first, each once. Pure, tested. */
export const withRecent = (list: readonly Picked[], p: Picked): Picked[] =>
  [p, ...list.filter((x) => x.emoji !== p.emoji)].slice(0, KEEP);

export function openEmojiPicker(
  env: ViewEnv,
  anchor: HTMLElement,
  pick: (p: Picked) => void,
): void {
  let custom: readonly EmojiRow[] = [];
  const input = h('input', {
    type: 'search',
    placeholder: t('emoji.search'),
    'aria-label': t('emoji.search'),
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const grid = h('div', { class: 'egrid' });
  const panel = h(
    'div',
    { class: 'epick', role: 'dialog', 'aria-label': t('emoji.pick') },
    input,
    grid,
  );
  const choose = (p: Picked): void => {
    kv.set(RECENT, withRecent(recentEmoji(), p));
    close();
    pick(p);
  };
  const cell = (p: Picked): HTMLElement =>
    h(
      'button',
      { class: 'ecell', title: p.emoji, 'aria-label': p.emoji, onclick: () => choose(p) },
      p.url ? h('img', { src: p.url, alt: p.emoji, draggable: false }) : p.emoji,
    );
  const draw = (): void => {
    const typed = input.value.trim();
    const words = typed.toLowerCase().replace(/:/g, '');
    const mine = custom
      .filter((c) => c.code.toLowerCase().includes(words))
      .map((c): Picked => ({ emoji: `:${c.code}:`, url: c.url }));
    const glyphs = findGlyphs(typed).map((g): Picked => ({ emoji: g.emoji }));
    const groups = typed
      ? [[...(isEmoji(typed) ? [{ emoji: typed }] : []), ...mine, ...glyphs]]
      : [recentEmoji(), mine, glyphs];
    const shown = groups.filter((g) => g.length);
    replaceChildren(
      grid,
      shown.length
        ? shown.map((g) => h('div', { class: 'egroup' }, g.map(cell)))
        : h('div', { class: 'muted enone' }, t('emoji.none')),
    );
  };
  const cells = (): HTMLElement[] => [...grid.querySelectorAll<HTMLElement>('.ecell')];
  input.addEventListener('input', draw);
  panel.addEventListener('keydown', (e) => {
    const all = cells();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const first = all[0];
    if (e.key === 'Enter' && at < 0 && !e.isComposing) first?.click();
    else if (e.key === 'ArrowDown' && at < 0) first?.focus();
    else if (at >= 0 && e.key.startsWith('Arrow')) {
      // The grid's rows are whatever fits: the cell above or below is the nearest one in that direction.
      const from = all[at]?.getBoundingClientRect();
      const side = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const down = e.key === 'ArrowDown';
      const target = side
        ? all[at + side]
        : (down ? all.slice(at + 1) : all.slice(0, at).reverse()).find((c) => {
            const r = c.getBoundingClientRect();
            return from && r.top !== from.top && Math.abs(r.left - from.left) < 2;
          });
      if (target) target.focus();
      else if (!down && !side) input.focus();
    } else return;
    e.preventDefault();
  });
  const account = env.engine.me();
  const rows = (next: readonly Row[]): void => {
    custom = next.filter((r): r is EmojiRow => r.kind === 'emoji');
    draw();
  };
  const sub = env.engine.open(
    { source: 'emoji', account: account || undefined },
    { rows, patch: () => undefined },
  );
  sub.window('top', 0, 400);
  draw();
  const close = openPopover(env.layer, anchor, panel, { panel: true, closed: () => sub.close() });
  // A finger wants the grid, not an on-screen keyboard over it.
  if (!matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
}
