import type { Query } from '../protocol.ts';
import { PEOPLE, type Person } from './people.ts';
import type { Entry } from './query.ts';
import { personRow } from './rows.ts';
import type { MNote, World } from './world.ts';

const fold = (value: string): string => value.normalize('NFKC').toLowerCase();
const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The mock's retained directory has the same six-person, all-word policy as core. */
export function searchPeople(w: World, q: Query, me: string): Entry[] {
  const words = fold(q.text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const muted = new Set(w.state.mutes.flatMap((m) => (m.k === 'person' ? [m.pubkey] : [])));
  const rank = (p: Person): number =>
    p.author.pubkey === me ? 0 : w.state.following.has(p.author.pubkey) ? 1 : 2;
  return PEOPLE.filter((p) => {
    const fields = [p.author.name, p.handle, p.author.nip05 ?? ''].map(fold);
    return (
      !muted.has(p.author.pubkey) && words.every((word) => fields.some((f) => f.includes(word)))
    );
  })
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        order(fold(a.author.name), fold(b.author.name)) ||
        order(a.author.pubkey, b.author.pubkey),
    )
    .slice(0, 6)
    .map((p) => {
      const key = `search-person:${p.author.pubkey}`;
      return { key, row: () => ({ ...personRow(w, p, me), key, weight: [64, 32, 1][rank(p)] }) };
    });
}

/** Explicit fixture labels or the same removable en/ja script heuristic as core. */
export function matchesLanguage(note: MNote, languages: Query['language']): boolean {
  return (
    !languages?.length ||
    languages.some(
      (lang) =>
        note.languages?.includes(lang) ||
        (lang === 'en' && /[a-z]/i.test(note.text)) ||
        (lang === 'ja' && /[\u3040-\u30ff\u3400-\u9fff]/u.test(note.text)),
    )
  );
}

export function searchPrefix(entries: readonly Entry[]): number {
  let count = 0;
  while (count < 6 && entries[count]?.key.startsWith('search-person:')) count++;
  return count;
}
