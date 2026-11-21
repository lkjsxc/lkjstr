// What the mention picker draws: its choices or one quiet line saying why there are none, where it sits beside the
// caret, and the chips under the field naming the people the note will mention.
import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { avatar, plainName } from './parts.ts';

/** `hint`: a bare @ with nobody to suggest; `none`: a typed name nobody seen here matches; `looking`: a NIP-05
 * address is being asked. */
export type Quiet = 'hint' | 'none' | 'looking';

export const MENU_MAX = 264;

export function option(author: Author, on: boolean, take: () => void): HTMLElement {
  return h(
    'button',
    {
      class: on ? 'on' : '',
      role: 'option',
      'aria-selected': on,
      tabindex: -1,
      // The field keeps the keyboard (and a phone its on-screen keyboard) while a choice is pressed.
      onpointerdown: (e) => e.preventDefault(),
      onclick: take,
    },
    avatar(author, 'av sm'),
    h(
      'span',
      { class: 'clip' },
      h('b', null, plainName(author)),
      h('small', { class: 'muted' }, author.nip05 || shortKey(author)),
    ),
  );
}

export function lookupOption(name: string, on: boolean, run: () => void): HTMLElement {
  return h(
    'button',
    {
      class: on ? 'on' : '',
      role: 'option',
      'aria-selected': on,
      tabindex: -1,
      onpointerdown: (e) => e.preventDefault(),
      onclick: run,
    },
    t('mention.lookup', { name }),
  );
}

export function quietLine(quiet: Quiet, name: string): HTMLElement {
  return h(
    'div',
    { class: 'mention-quiet muted', role: 'status' },
    t(quiet === 'hint' ? 'mention.hint' : quiet === 'none' ? 'mention.none' : 'mention.looking', {
      name,
    }),
  );
}

const shortKey = (a: Author): string => {
  const key = a.npub || a.pubkey;
  return key.length > 20 ? `${key.slice(0, 12)}…${key.slice(-6)}` : key;
};

/** One person the note will mention, with their face when it is known. */
export function chip(label: string, author: Author | undefined): HTMLElement {
  return h(
    'span',
    { class: 'mchip', title: author ? author.nip05 || author.npub : label },
    author ? avatar(author, 'av xs') : null,
    h('span', { class: 'clip' }, label),
  );
}

/** Puts the open menu under the caret's line, or above it when there is more room there (a field low in its tile,
 * or a phone's on-screen keyboard), never past the tile or the visible viewport. */
export function placeMenu(menu: HTMLElement, area: HTMLTextAreaElement, host: HTMLElement): void {
  const css = getComputedStyle(area);
  const line = Number.parseFloat(css.lineHeight) || 24;
  const marker = h('span', null, '​');
  const mirror = h(
    'div',
    {
      style: `position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${area.clientWidth}px;font:${css.font};line-height:${css.lineHeight};padding:${css.padding}`,
    },
    area.value.slice(0, area.selectionStart),
    marker,
  );
  host.append(mirror);
  const caret = Math.max(0, marker.offsetTop - area.scrollTop) + area.clientTop;
  const left = Math.max(0, Math.min(marker.offsetLeft, area.clientWidth - 300));
  mirror.remove();
  const box = host.getBoundingClientRect();
  const tile = area.closest('.view')?.getBoundingClientRect();
  const port = globalThis.visualViewport;
  const floor = Math.min(
    tile?.bottom ?? innerHeight,
    port ? port.offsetTop + port.height : innerHeight,
  );
  const ceiling = Math.max(tile?.top ?? 0, port?.offsetTop ?? 0);
  const below = floor - (box.top + caret + line) - 8;
  const above = box.top + caret - ceiling - 8;
  menu.style.maxHeight = `${MENU_MAX}px`;
  const want = Math.min(MENU_MAX, menu.scrollHeight + 2);
  const down = below >= want || below >= above;
  const room = Math.max(44, Math.min(MENU_MAX, down ? below : above));
  menu.style.maxHeight = `${room}px`;
  menu.style.left = `${left}px`;
  menu.style.top = `${down ? caret + line : caret - Math.min(want, room)}px`;
  menu.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}
