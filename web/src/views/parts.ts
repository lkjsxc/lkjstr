// Small pieces every view draws people and text with.
import type { Author, Emoji, Segment } from '../engine/protocol.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { UNDO_MS } from './held.ts';
import type { ViewEnv } from './registry.ts';

/** Shift-click opens in a new tile beside; a middle click opens behind. */
export const how = (e: MouseEvent): { split?: boolean; background?: boolean } => ({
  split: e.shiftKey,
  background: e.button === 1,
});

/** A name the engine has not learned yet arrives empty, as the pubkey or as the whole npub. None of those is a
 * name: the person is shown by a short npub until the profile comes, and the real name then takes its place. */
const RAW = /^(?:[0-9a-f]{64}|npub1[a-z0-9]{40,})$/;
export const unnamed = (a: Author): boolean => !a.name.trim() || RAW.test(a.name.trim());
const brief = (key: string): string =>
  key.length > 18 ? `${key.slice(0, key.startsWith('npub1') ? 10 : 8)}…${key.slice(-4)}` : key;
export const shortNpub = (a: Author): string => brief(a.npub || a.pubkey);
/** A name that came alone (a mention): shortened when it is a key. */
export const nameText = (name: string): string =>
  RAW.test(name.trim()) ? brief(name.trim()) : name;
const nameOf = (a: Author): string => (unnamed(a) ? shortNpub(a) : a.name);

/** A circle: the picture, or a flat colour from the pubkey with the first letter of the name. */
export function avatar(a: Author, cls = 'av'): HTMLElement {
  const hue = Number.parseInt(a.pubkey.slice(0, 4), 16) % 360;
  const el = h('span', {
    class: cls,
    style: `background:hsl(${hue} 35% 55%)`,
    'aria-hidden': 'true',
  });
  if (a.picture) {
    const img = h('img', {
      src: a.picture,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      draggable: false,
    });
    img.addEventListener('error', () => img.remove()); // the flat circle stays, same size
    el.append(img);
  } else if (!unnamed(a)) el.append([...a.name.replace(/:[a-z0-9_]+:/g, '').trim()][0] ?? '');
  return el;
}

/** Text with `:code:` replaced by the custom emoji it names. */
export function withEmoji(text: string, emoji: readonly Emoji[] = []): Child[] {
  if (!emoji.length) return [text];
  const by = new Map(emoji.map((e) => [e.code, e.url]));
  return text.split(/(:[a-z0-9_]+:)/g).map((part) => {
    const url = part.startsWith(':') ? by.get(part.slice(1, -1)) : undefined;
    return url ? emojiImg(part, url) : part;
  });
}
/** A custom emoji. One whose picture cannot be had is its `:code:` as plain text, not a broken image. */
export function emojiImg(code: string, url: string): HTMLElement {
  const img = h('img', { class: 'emo', src: url, alt: code, title: code, draggable: false });
  img.addEventListener('error', () => img.replaceWith(code));
  return img;
}

export const displayName = (a: Author): Child[] => withEmoji(nameOf(a), a.emoji);
/** The name as plain text (tab titles, tooltips). */
export const plainName = (a: Author): string =>
  nameOf(a)
    .replace(/\s*:[a-z0-9_]+:/g, '')
    .trim() || shortNpub(a);

/** A person's name as a button that opens their profile. */
export function nameButton(a: Author, env: ViewEnv, cls = 'name'): HTMLElement {
  const el = h('button', { class: cls, title: a.nip05 ?? a.npub }, displayName(a));
  const go = (e: MouseEvent): void => {
    e.stopPropagation();
    env.open('profile', { pubkey: a.pubkey, title: plainName(a) }, how(e));
  };
  el.addEventListener('click', go);
  el.addEventListener('auxclick', (e) => void (e.button === 1 && go(e)));
  return el;
}

/** A person's face as a button that opens their profile, as the name does. */
export function faceButton(a: Author, env: ViewEnv, cls = 'av'): HTMLElement {
  const name = plainName(a);
  const el = h('button', { class: 'avb', title: name, 'aria-label': name }, avatar(a, cls));
  const go = (e: MouseEvent): void => {
    e.stopPropagation();
    env.open('profile', { pubkey: a.pubkey, title: name }, how(e));
  };
  el.addEventListener('click', go);
  el.addEventListener('auxclick', (e) => void (e.button === 1 && go(e)));
  return el;
}

/** Note text. Links say where they go; mentions and hashtags open tabs. */
export function segments(list: readonly Segment[], env: ViewEnv): Child[] {
  return list.map((s) => {
    if (s.k === 'text') return s.text;
    if (s.k === 'emoji') return emojiImg(`:${s.code}:`, s.url);
    if (s.k === 'link')
      return h(
        'a',
        {
          href: s.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: s.url,
          onclick: (e) => e.stopPropagation(),
        },
        s.text,
      );
    const open = (kind: string, state: object) => (e: Event) => {
      e.stopPropagation();
      env.open(kind, state, how(e as MouseEvent));
    };
    if (s.k === 'mention')
      return h(
        'button',
        { class: 'lnk', onclick: open('profile', { pubkey: s.pubkey, title: nameText(s.name) }) },
        `@${nameText(s.name).replace(/\s*:[a-z0-9_]+:/g, '')}`,
      );
    if (s.k === 'hashtag')
      return h('button', { class: 'lnk', onclick: open('hashtag', { tag: s.tag }) }, `#${s.tag}`);
    const kind = s.bech32.startsWith('np') ? 'profile' : 'thread';
    return h('button', { class: 'lnk', onclick: open(kind, { ref: s.bech32 }) }, s.text);
  });
}

/** A quiet message that goes away by itself (after a copy, for an error). With `undo` it stays longer and carries
 * a button that takes the action back (or, named by `label`, leads on); up to three of those wait together, so
 * quick removals stay undoable. */
export function toast(layer: HTMLElement, text: string, undo?: () => void, label?: string): void {
  let box = layer.querySelector<HTMLElement>('.toasts');
  if (!box) layer.append((box = h('div', { class: 'toasts' })));
  const el: HTMLElement = h('div', { class: undo ? 'toast undo' : 'toast', role: 'status' }, text);
  if (undo) {
    el.append(
      h('button', { class: 'lnk', onclick: () => (el.remove(), undo()) }, label ?? t('undo')),
    );
    const waiting = box.querySelectorAll('.toast.undo');
    if (waiting.length >= 3) waiting[0]?.remove();
  } else box.querySelector('.toast:not(.undo)')?.remove();
  box.append(el);
  setTimeout(() => el.remove(), undo ? UNDO_MS : 2200);
}
export async function copy(env: ViewEnv, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(env.layer, t('copied'));
  } catch {
    toast(env.layer, t('copyFailed'));
  }
}
