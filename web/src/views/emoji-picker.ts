// The emoji picker, one for the composer, reactions and private messages: a panel under the button that opened it.
// A search field and the skin tone; a row of categories; the grid (frequently used first, then the reader's custom
// emoji by set (NIP-30 and NIP-51, from the engine), then the Unicode categories); and a strip at the foot that says
// what is under the pointer, the keyboard or a resting finger. Every part has a fixed size, so nothing moves.
import type { Emoji, EmojiRow, Row } from '../engine/protocol.ts';
import { toned } from '../shared/emoji-find.ts';
import { COMMON, emojiTable, emojiTableNow } from '../shared/emoji-table.ts';
import { type Picked, recordPick, setSkinTone, skinTone, usedEmoji } from '../shared/emoji-used.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { openPopover } from '../wm/menus.ts';
import { createGrid, type Section } from './emoji-grid.ts';
import { createPreview, emojiPicture, type Item } from './emoji-preview.ts';
import { CAT_ICONS, emojiSections, patched } from './emoji-sections.ts';
import type { ViewEnv } from './registry.ts';

export type { Picked } from '../shared/emoji-used.ts';
/** The emoji tag a custom pick puts on what is sent; undefined for a Unicode emoji. */
export const emojiTag = (p: Picked): Emoji | undefined =>
  p.url
    ? { code: p.emoji.slice(1, -1), url: p.url, ...(p.address ? { address: p.address } : {}) }
    : undefined;
const coarse = (): boolean => matchMedia('(pointer: coarse)').matches;
const TONES = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];
/** The last custom emoji seen per account: a second opening draws them at once. Bound: accounts on the device. */
const seen = new Map<string, readonly EmojiRow[]>();

export function openEmojiPicker(
  env: ViewEnv,
  anchor: HTMLElement,
  pick: (p: Picked) => void,
): void {
  const account = env.engine.me() || '';
  let custom: readonly EmojiRow[] = seen.get(account) ?? [];
  let table = emojiTableNow();
  let tone = skinTone();

  const input = h('input', {
    type: 'search',
    placeholder: t('emoji.search'),
    'aria-label': t('emoji.search'),
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const toneButton = h('button', { class: 'etone', 'aria-label': t('emoji.tone') }, TONES[tone]);
  const tones = h(
    'div',
    { class: 'etones', role: 'radiogroup', 'aria-label': t('emoji.tone'), hidden: true },
    TONES.map((glyph, i) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-label': t(`emoji.tone${i}` as Key),
          title: t(`emoji.tone${i}` as Key),
          onclick: () => setTone(i),
        },
        glyph,
      ),
    ),
  );
  const head = h('div', { class: 'ehead' }, input, toneButton, tones);
  const cats = h('div', { class: 'ecats', role: 'toolbar', 'aria-label': t('emoji.cats') });
  const preview = createPreview();
  const grid = createGrid({
    choose,
    preview: (item) => preview.show(item ?? (input.value.trim() ? grid.first() : undefined), tone),
    section: (id) => {
      for (const b of cats.children)
        b.classList.toggle('on', (b as HTMLElement).dataset.section === id);
    },
    // On a touch screen a redraw does not call up the on-screen keyboard.
    leaveTop: (lost) => void ((lost && coarse()) || input.focus({ preventScroll: true })),
    tone: () => tone,
  });
  const panel = h(
    'div',
    { class: 'epick', role: 'dialog', 'aria-label': t('emoji.pick') },
    head,
    cats,
    grid.el,
    preview.el,
  );

  function choose(item: Item): void {
    const p: Picked = item.glyph ? { emoji: toned(item.glyph, tone) } : item.picked;
    recordPick(p);
    close();
    pick(p);
  }
  function setTone(i: number): void {
    tone = i;
    setSkinTone(i);
    toneButton.textContent = TONES[i] ?? '✋';
    showTones(false);
    grid.retone();
    toneButton.focus();
  }
  function showTones(on: boolean): void {
    tones.hidden = !on;
    input.hidden = toneButton.hidden = on;
    for (const [i, b] of [...tones.children].entries())
      b.setAttribute('aria-checked', String(i === tone));
    if (on) (tones.children[tone] as HTMLElement | undefined)?.focus();
  }
  toneButton.addEventListener('click', () => showTones(true));

  function drawCats(list: readonly Section[]): void {
    const button = (s: Section, face: Node): HTMLElement =>
      h(
        'button',
        {
          'data-section': s.id,
          'aria-label': s.label,
          title: s.label,
          tabindex: -1,
          onclick: () => {
            if (input.value) {
              input.value = '';
              draw();
            }
            grid.jump(s.id);
          },
        },
        face,
      );
    replaceChildren(
      cats,
      list
        .filter((s) => s.label && s.items.length)
        .map((s) => {
          if (s.id === 'used') return button(s, icon('clock'));
          if (s.id.startsWith('cat:'))
            return button(s, h('span', null, CAT_ICONS[Number(s.id.slice(4))] ?? ''));
          const first = s.items[0]?.picked;
          return button(
            s,
            first?.url ? emojiPicture(first.emoji, first.url, 'eimg') : h('span', null, '?'),
          );
        }),
    );
    (cats.firstElementChild as HTMLElement | null)?.setAttribute('tabindex', '0');
  }
  function draw(keep = false): void {
    const list = emojiSections(custom, table, usedEmoji(), input.value.trim());
    if (!input.value.trim()) drawCats(list);
    grid.draw(list, keep);
    preview.show(input.value.trim() ? grid.first() : undefined, tone);
  }

  input.addEventListener('input', () => draw());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const first = grid.first();
      if (first) choose(first);
    } else if (e.key === 'ArrowDown') e.preventDefault(), grid.focusFirst();
  });
  cats.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const all = [...cats.children] as HTMLElement[];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const to = all[Math.max(0, Math.min(all.length - 1, at + (e.key === 'ArrowLeft' ? -1 : 1)))];
    if (!to) return;
    e.preventDefault();
    for (const b of all) b.tabIndex = b === to ? 0 : -1;
    to.focus();
  });
  tones.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const all = [...tones.children] as HTMLElement[];
    const at = all.indexOf(document.activeElement as HTMLElement);
    all[(at + (e.key === 'ArrowLeft' ? all.length - 1 : 1)) % all.length]?.focus();
  });

  const remember = (next: readonly EmojiRow[]): void => {
    custom = next;
    seen.set(account, next);
    draw(true);
  };
  const sub = env.engine.open(
    { source: 'emoji', account: account || undefined },
    {
      rows: (next: readonly Row[]) =>
        remember(next.filter((r): r is EmojiRow => r.kind === 'emoji')),
      patch: (ops) => remember(patched(custom, ops)),
    },
  );
  sub.window('top', 0, 400);
  draw();
  if (!table)
    void emojiTable().then((list) => {
      if (list === COMMON || !panel.isConnected) return;
      table = list;
      draw(true);
    });
  const close = openPopover(env.layer, anchor, panel, {
    panel: true,
    closed: () => (sub.close(), grid.stop()),
  });
  // A finger wants the grid, not an on-screen keyboard over it.
  if (!coarse()) input.focus({ preventScroll: true });
}
