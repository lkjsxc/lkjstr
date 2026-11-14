// Small pieces every view draws people and text with.
import type { Author, Emoji, Segment } from '../engine/protocol.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import type { ViewEnv } from './registry.ts';

/** Shift-click opens in a new tile beside; a middle click opens behind. */
export const how = (e: MouseEvent): { split?: boolean; background?: boolean } => ({
  split: e.shiftKey,
  background: e.button === 1,
});

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
  } else el.append([...a.name.replace(/:[a-z0-9_]+:/g, '').trim()][0] ?? '');
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
export const emojiImg = (code: string, url: string): HTMLElement =>
  h('img', { class: 'emo', src: url, alt: code, title: code, draggable: false });

export const displayName = (a: Author): Child[] => withEmoji(a.name, a.emoji);
/** The name as plain text (tab titles, tooltips). */
export const plainName = (a: Author): string =>
  a.name.replace(/\s*:[a-z0-9_]+:/g, '').trim() || a.npub.slice(0, 12);

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
        { class: 'lnk', onclick: open('profile', { pubkey: s.pubkey, title: s.name }) },
        `@${s.name.replace(/\s*:[a-z0-9_]+:/g, '')}`,
      );
    if (s.k === 'hashtag')
      return h('button', { class: 'lnk', onclick: open('hashtag', { tag: s.tag }) }, `#${s.tag}`);
    const kind = s.bech32.startsWith('np') ? 'profile' : 'thread';
    return h('button', { class: 'lnk', onclick: open(kind, { ref: s.bech32 }) }, s.text);
  });
}

/** A quiet message that goes away by itself (after a copy, for an error). */
export function toast(layer: HTMLElement, text: string): void {
  layer.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, text);
  layer.append(el);
  setTimeout(() => el.remove(), 2200);
}
export async function copy(env: ViewEnv, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(env.layer, t('copied'));
  } catch {
    toast(env.layer, t('copyFailed'));
  }
}
