// A face starts as a letter. Its mounted owner supplies the image lease.
import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { knownPerson } from '../shared/people.ts';

export type FaceOptions = { cachePublic?: boolean; lazy?: boolean };
type Face = { author: Author; options: FaceOptions; letter: HTMLElement; changed?: () => void };
const faces = new WeakMap<HTMLElement, Face>(); // Model index only; avatar-owner owns every live lease.
const letterOf = (a: Author): string =>
  !a.name.trim() || /^(?:[0-9a-f]{64}|npub1[a-z0-9]{40,})$/.test(a.name.trim())
    ? ''
    : ([...a.name.replace(/:[a-z0-9_]+:/g, '').trim()][0] ?? '');
export const avatarOptions = (el: HTMLElement): FaceOptions => faces.get(el)?.options ?? {};
export const avatarModel = (el: HTMLElement): Author | undefined => faces.get(el)?.author;
export function updateAvatar(el: HTMLElement, author: Author): void {
  const face = faces.get(el);
  if (!face || JSON.stringify(face.author) === JSON.stringify(author)) return;
  face.author = author;
  const letter = letterOf(author);
  if (face.letter.textContent !== letter) face.letter.textContent = letter;
  face.changed?.();
}
export function observeAvatar(el: HTMLElement, changed: () => void): () => void {
  const face = faces.get(el);
  if (face) face.changed = changed;
  return () => {
    if (face?.changed === changed) face.changed = undefined;
  };
}
export function refreshAvatar(el: HTMLElement): void {
  const face = faces.get(el);
  const author = face && knownPerson(face.author.pubkey);
  if (author) updateAvatar(el, author);
}
/** A row redraw may keep its old face, but must carry the new picture and display size into it. */
export function reuseAvatar(el: HTMLElement, fresh: HTMLElement): void {
  const author = avatarModel(fresh);
  if (el.className !== fresh.className) el.className = fresh.className;
  if (author) updateAvatar(el, author);
}
export function avatar(a: Author, cls = 'av', options: FaceOptions = {}): HTMLElement {
  const author = knownPerson(a.pubkey) ?? a;
  const hue = Number.parseInt(a.pubkey.slice(0, 4), 16) % 360;
  const letter = h('span', { class: 'faceletter' }, letterOf(author));
  const el = h(
    'span',
    {
      class: cls,
      style: `background:hsl(${hue} 35% 55%)`,
      'aria-hidden': 'true',
      'data-face': a.pubkey,
    },
    letter,
  );
  faces.set(el, { author, letter, options });
  return el;
}
