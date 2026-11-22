// Small pieces every view draws people and text with.
import type { Author, Emoji, Segment } from '../engine/protocol.ts';
import { emojiRuns } from '../shared/emoji-text.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { loadImage } from '../shared/media-source.ts';
import { knownPerson } from '../shared/people.ts';
import { avatar, updateAvatar, type FaceOptions } from './avatars.ts';
export { avatar } from './avatars.ts';
import { inlineEmoji } from './emoji-load.ts';
import { UNDO_MS } from './held.ts';
import { nameState } from './name-arrival.ts';
import type { ViewEnv } from './registry.ts';

/** Shift-click splits a new tile off to the right; a middle click opens behind. */
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

/** Profile and editor share the banner's quiet background when its picture is unavailable. */
export function showBanner(el: HTMLElement, url: string | undefined): void {
  const old = el.querySelector('img');
  if (old?.dataset.picture === url) return;
  el.replaceChildren();
  if (!url) return;
  const img = h('img', { alt: '', decoding: 'async', 'data-picture': url });
  el.append(img);
  loadImage(img, url, () => img.remove());
}

/** Unicode emoji in text, each one grapheme in an inline mark that wraps, selects and copies as the characters it
 * holds; its popover (emoji-peek.ts) says what it is. `focusable`: it stands alone (not inside a button or link), so
 * the keyboard can reach it and its popover, as a custom emoji's. */
export const unicodeEmoji = (text: string, focusable = false): Child[] =>
  emojiRuns(text).map((run) =>
    typeof run === 'string'
      ? run
      : h('span', { class: 'uemo', tabindex: focusable ? 0 : null }, run.emoji),
  );

/** Text with `:code:` replaced by the custom emoji it names, and its Unicode emoji marked. */
export function withEmoji(text: string, emoji: readonly Emoji[] = []): Child[] {
  if (!emoji.length) return unicodeEmoji(text);
  const by = new Map(emoji.map((e) => [e.code, e]));
  return text.split(/(:[A-Za-z0-9_-]+:)/g).flatMap((part) => {
    const own = part.startsWith(':') ? by.get(part.slice(1, -1)) : undefined;
    return own ? [emojiImg(part, own.url, false, own)] : unicodeEmoji(part);
  });
}
/** A custom emoji in text (emoji-load.ts): a box of the line's height that does not change while in view, a picture
 * loaded ahead of the reader, and its `:code:` when the picture cannot be had. What it is shows in a popover
 * (emoji-peek.ts), so it has no tooltip of its own. `focusable`: it stands alone (not inside a button or link), so
 * the keyboard can reach it and its popover. */
export function emojiImg(
  code: string,
  url: string,
  focusable = false,
  provenance?: Pick<Emoji, 'address' | 'set'>,
): HTMLElement {
  const image = inlineEmoji(code, url, focusable);
  if (provenance?.address) image.dataset.emojiAddress = provenance.address;
  if (provenance?.set) image.dataset.emojiSet = provenance.set;
  return image;
}

export const displayName = (a: Author): Child[] => withEmoji(nameOf(a), a.emoji);
/** The name as plain text (tab titles, tooltips). */
export const plainName = (a: Author): string =>
  nameOf(a)
    .replace(/\s*:[A-Za-z0-9_-]+:/g, '')
    .trim() || shortNpub(a);

/** A person's name as a button that opens their profile. */
export function nameButton(a: Author, env: ViewEnv, cls = 'name'): HTMLElement {
  // The whole name first (a long one is cut), then who it is.
  const state = nameState(a.pubkey, unnamed(a));
  const el = h(
    'button',
    {
      class: state ? `${cls} ${state}` : cls,
      dir: 'auto',
      title: `${plainName(a)}\n${a.nip05 ?? a.npub}`,
    },
    displayName(a),
  );
  const go = (e: MouseEvent): void => {
    e.stopPropagation();
    env.open('profile', { pubkey: a.pubkey, title: plainName(a) }, how(e));
  };
  el.addEventListener('click', go);
  el.addEventListener('auxclick', (e) => void (e.button === 1 && go(e)));
  return el;
}

/** A person's face as a button that opens their profile, as the name does. */
export function faceButton(
  a: Author,
  env: ViewEnv,
  cls = 'av',
  options?: FaceOptions,
): HTMLElement {
  const name = plainName(a);
  const el = h(
    'button',
    { class: 'avb', title: name, 'aria-label': name },
    avatar(a, cls, options),
  );
  const go = (e: MouseEvent): void => {
    e.stopPropagation();
    env.open('profile', { pubkey: a.pubkey, title: el.title }, how(e));
  };
  el.addEventListener('click', go);
  el.addEventListener('auxclick', (e) => void (e.button === 1 && go(e)));
  return el;
}

/** Reuse the public note's author control across metadata updates and body redraws. */
export function noteFace(
  a: Author,
  env: ViewEnv,
  previous?: HTMLElement,
  lazy = false,
): HTMLElement {
  const button = previous?.querySelector<HTMLElement>(':scope > .nrow > .avb');
  const face = button?.firstElementChild as HTMLElement | null | undefined;
  if (!button || face?.dataset.face !== a.pubkey)
    return faceButton(a, env, 'av', { cachePublic: true, lazy });
  const name = plainName(a);
  if (button.title !== name) {
    button.title = name;
    button.setAttribute('aria-label', name);
  }
  updateAvatar(face, knownPerson(a.pubkey) ?? a);
  return button;
}

/** Note text. Links say where they go; mentions and hashtags open tabs. `inside`: drawn inside a control (a
 * quoted note), so its custom emoji take no tab stop of their own. */
export function segments(list: readonly Segment[], env: ViewEnv, inside = false): Child[] {
  return list.map((s) => {
    if (s.k === 'text') return unicodeEmoji(s.text, !inside);
    if (s.k === 'emoji') return emojiImg(`:${s.code}:`, s.url, !inside, s);
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
        unicodeEmoji(`@${nameText(s.name).replace(/\s*:[a-z0-9_]+:/g, '')}`),
      );
    if (s.k === 'hashtag')
      return h('button', { class: 'lnk', onclick: open('hashtag', { tag: s.tag }) }, `#${s.tag}`);
    const kind = s.bech32.startsWith('np') ? 'profile' : 'thread';
    return h('button', { class: 'lnk', onclick: open(kind, { ref: s.bech32 }) }, s.text);
  });
}

/** A quiet message that goes away by itself (after a copy, for an error). With `undo` it stays longer and carries
 * a button that takes the action back (or, named by `label`, leads on); up to three of those wait together, so
 * quick removals stay undoable. Returns what withdraws it early. */
export function toast(
  layer: HTMLElement,
  text: string,
  undo?: () => void,
  label?: string,
): () => void {
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
  return () => el.remove();
}
export async function copy(env: ViewEnv, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(env.layer, t('copied'));
  } catch {
    toast(env.layer, t('copyFailed'));
  }
}

/** The person's checked name beside their name (also on the reader's own unsigned draft in Home). */
export const nipMark = (a: Author): HTMLElement | null =>
  a.nip05
    ? h(
        'span',
        {
          class: a.verified ? 'nip ok' : 'nip',
          title: `${a.nip05}\n${a.verified ? t('nip05.ok') : t('nip05.unchecked')}`,
        },
        a.verified ? icon('check') : null,
        a.nip05,
      )
    : null;
