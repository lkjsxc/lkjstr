// What the profile editor edits: the fields of `ProfileEdit` as typed, where they start from, whether they are
// fit to save, and the profile a save sends. Nothing here touches the page.
import type { ProfileEdit } from '../engine/protocol.ts';
import type { Key } from '../shared/i18n.ts';

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
    if (s && !unchanged(f, v, base) && !ok(s)) out[f] = why;
  };
  const image = (s: string): boolean => uploaded.has(s) || (s.startsWith('https://') && parses(s));
  check('picture', image, 'pedit.badImage');
  check('banner', image, 'pedit.badImage');
  check('website', (s) => /^https?:\/\//.test(s) && parses(s), 'pedit.badWebsite');
  check('nip05', (s) => ADDRESS.test(s) || DOMAIN.test(s), 'pedit.badAddress');
  check('lud16', (s) => ADDRESS.test(s), 'pedit.badAddress');
  return out;
}

/** The textarea normalizes line endings and single-line inputs drop them. */
function unchanged(field: Field, value: Values, base: Values): boolean {
  const normalized =
    field === 'about' ? base.about.replace(/\r\n?/g, '\n') : base[field].replace(/[\r\n]/g, '');
  return value[field].trim() === normalized.trim();
}

/** Preserve untouched text. Trim edits and expand a newly entered bare NIP-05 domain. */
export function profileOf(v: Values, base: Values): ProfileEdit {
  const field = (f: Field): string => (unchanged(f, v, base) ? base[f] : v[f].trim());
  const nip05 = field('nip05');
  return {
    name: field('name'),
    about: field('about'),
    picture: field('picture') || undefined,
    banner: field('banner') || undefined,
    nip05:
      nip05 && !unchanged('nip05', v, base) && !nip05.includes('@')
        ? `_@${nip05}`
        : nip05 || undefined,
    website: field('website') || undefined,
    lud16: field('lud16') || undefined,
  };
}

export const same = (a: Values, b: Values): boolean => FIELDS.every((f) => unchanged(f, a, b));
