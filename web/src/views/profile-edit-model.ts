// What the profile editor edits: the fields of `ProfileEdit` as typed, where they start from, whether they are
// fit to save, and the profile a save sends. Nothing here touches the page.
import type { ProfileEdit, ProfileRow, Segment } from '../engine/protocol.ts';
import type { Key } from '../shared/i18n.ts';
import { unnamed } from './parts.ts';

export const FIELDS = ['name', 'about', 'picture', 'banner', 'nip05', 'website', 'lud16'] as const;
export type Field = (typeof FIELDS)[number];
/** Every field as the reader has it in the form: text, '' for none. */
export type Values = Record<Field, string>;

const text = (s: string | undefined): string => s ?? '';

export const valuesOf = (e: ProfileEdit): Values => ({
  name: e.name,
  about: e.about,
  picture: text(e.picture),
  banner: text(e.banner),
  nip05: text(e.nip05),
  website: text(e.website),
  lud16: text(e.lud16),
});

/** About as it would have been typed, from the segments it is shown by. A link is its whole address, a custom
 * emoji its `:code:`; a reference keeps its `nostr:` form. What the engine shows as nothing stays nothing, which
 * is why a rebuilt About is pointed out to the reader. */
export function aboutText(segments: readonly Segment[]): string {
  return segments
    .map((s) =>
      s.k === 'text'
        ? s.text
        : s.k === 'link'
          ? s.url
          : s.k === 'emoji'
            ? `:${s.code}:`
            : s.k === 'hashtag'
              ? `#${s.tag}`
              : s.k === 'ref'
                ? `nostr:${s.bech32}`
                : `@${s.name}`,
    )
    .join('');
}

/** Where the form starts: the fields as published when the engine gives them, else rebuilt from what is shown
 * (`rebuilt`). A profile that has not arrived starts empty (`fresh`). */
export function startOf(row: ProfileRow): { values: Values; rebuilt: boolean; fresh: boolean } {
  if (row.edit) return { values: valuesOf(row.edit), rebuilt: false, fresh: false };
  const a = row.author;
  const fresh = unnamed(a) && !row.about.length;
  const values: Values = {
    name: unnamed(a) ? '' : a.name,
    about: aboutText(row.about),
    picture: text(a.picture),
    banner: text(row.banner),
    nip05: text(a.nip05),
    website: text(row.website),
    lud16: text(row.lud16),
  };
  return { values, rebuilt: !fresh && values.about.trim() !== '', fresh };
}

const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s.]+$/;
const DOMAIN = /^[^@\s/]+\.[^@\s/.]+$/;
const parses = (url: string): boolean => URL.canParse(url);

/** Why a field cannot be saved, by field. A field left as it was is never refused: a picture the engine gave as
 * a data address, say, goes out again unchanged; nor is an address an upload of this form answered with. */
export function problems(
  v: Values,
  base: Values,
  uploaded: ReadonlySet<string> = new Set(),
): Partial<Record<Field, Key>> {
  const out: Partial<Record<Field, Key>> = {};
  const check = (f: Field, ok: (s: string) => boolean, why: Key): void => {
    const s = v[f].trim();
    if (s && s !== base[f].trim() && !ok(s)) out[f] = why;
  };
  const image = (s: string): boolean => uploaded.has(s) || (s.startsWith('https://') && parses(s));
  check('picture', image, 'pedit.badImage');
  check('banner', image, 'pedit.badImage');
  check('website', (s) => /^https?:\/\//.test(s) && parses(s), 'pedit.badWebsite');
  check('nip05', (s) => ADDRESS.test(s) || DOMAIN.test(s), 'pedit.badAddress');
  check('lud16', (s) => ADDRESS.test(s), 'pedit.badAddress');
  return out;
}

/** The profile a save sends: trimmed, an empty optional field left out. A NIP-05 name given as a bare domain
 * (the form the profile shows for `_@domain`) is written back as `_@domain`. */
export function profileOf(v: Values): ProfileEdit {
  const opt = (s: string): string | undefined => s.trim() || undefined;
  const nip05 = v.nip05.trim();
  return {
    name: v.name.trim(),
    about: v.about.trim(),
    picture: opt(v.picture),
    banner: opt(v.banner),
    nip05: nip05 && !nip05.includes('@') ? `_@${nip05}` : nip05 || undefined,
    website: opt(v.website),
    lud16: opt(v.lud16),
  };
}

export const same = (a: Values, b: Values): boolean =>
  FIELDS.every((f) => a[f].trim() === b[f].trim());
