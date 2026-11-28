// A face starts as a letter. Its mounted owner supplies the image lease.
import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { knownPerson } from '../shared/people.ts';

export type FaceOptions = {
  cachePublic?: boolean;
  lazy?: boolean;
  preview?: boolean;
  /** Header-only action: the original address of a successfully drawn picture, or no picture. */
  onImage?: (url?: string) => void;
};
type Face = {
  author: Author;
  options: FaceOptions;
  letter: HTMLElement;
  changed?: () => void;
  shownImage?: string;
};
const faces = new WeakMap<HTMLElement, Face>(); // Model index only; avatar-owner owns every live lease.
const letterOf = (a: Author): string =>
  !a.name.trim() || /^(?:[0-9a-f]{64}|npub1[a-z0-9]{40,})$/.test(a.name.trim())
    ? ''
    : ([...a.name.replace(/:[a-z0-9_]+:/g, '').trim()][0] ?? '');
export const avatarOptions = (el: HTMLElement): FaceOptions => faces.get(el)?.options ?? {};
export const avatarModel = (el: HTMLElement): Author | undefined => faces.get(el)?.author;
export function reportAvatarImage(el: HTMLElement, url?: string): void {
  const face = faces.get(el);
  if (!face?.options.onImage || face.shownImage === url) return;
  face.shownImage = url;
  face.options.onImage(url);
}
export function updateAvatar(el: HTMLElement, author: Author): void {
  const face = faces.get(el);
  if (!face || face.options.preview || JSON.stringify(face.author) === JSON.stringify(author))
    return;
  const pictureChanged = face.author.picture !== author.picture;
  face.author = author;
  const letter = letterOf(author);
  if (face.letter.textContent !== letter) face.letter.textContent = letter;
  if (pictureChanged) face.shownImage = undefined;
  // Refresh the header action even on a name-only update.
  face.options.onImage?.(face.shownImage);
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
/** Keep decoded faces across row replacement; each old face can serve only one new position. */
export function reuseAvatars(previous: HTMLElement, fresh: HTMLElement): void {
  const available = [...previous.querySelectorAll<HTMLElement>('[data-face]')];
  const unmatched = new Set(fresh.querySelectorAll<HTMLElement>('[data-face]'));
  // Reserve every exact-class match before an earlier loose match can consume it.
  for (const exact of [true, false]) {
    for (const face of unmatched) {
      const options = avatarOptions(face);
      if (options.preview) continue; // Editor drafts deliberately do not follow hydrated author updates.
      const index = available.findIndex(
        (old) =>
          old.dataset.face === face.dataset.face &&
          !avatarOptions(old).preview &&
          !!avatarOptions(old).cachePublic === !!options.cachePublic &&
          (!exact || old.className === face.className),
      );
      if (index < 0) continue;
      const old = available.splice(index, 1)[0]!;
      unmatched.delete(face);
      reuseAvatar(old, face);
      face.replaceWith(old);
    }
  }
}
export function avatar(a: Author, cls = 'av', options: FaceOptions = {}): HTMLElement {
  const author = options.preview ? a : (knownPerson(a.pubkey) ?? a);
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
