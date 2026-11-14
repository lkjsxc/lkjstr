// Which rows a query shows, in order. The mock materialises whole lists; the real engine pages its store.
import type { Query, Row } from '../protocol.ts';
import { finite } from './lists.ts';
import { byPubkey, byRef, FOLLOWERS, PEOPLE } from './people.ts';
import { noteRow, personRow, profileRow, type RowOpts } from './rows.ts';
import type { MNote, World } from './world.ts';

/** One row of a subscription's list: built when it is sent, so it always shows the current state. */
export type Entry = { readonly key: string; row(): Row };

const LISTS: Record<string, readonly string[]> = {
  photographers: ['aoi', 'marco', 'ichiro', 'mio'],
};
const hay = (n: MNote): string => `${n.text} ${n.by.author.name}`.toLowerCase();

/** Whether a note belongs to a note query (thread aside). */
export function matches(w: World, q: Query, n: MNote, me: string): boolean {
  const pk = n.by.author.pubkey;
  if (w.isMuted(n) && q.source !== 'profile') return false;
  if (q.authors?.length && !q.authors.includes(pk)) return false;
  if (q.since !== undefined && n.at < q.since) return false;
  if (q.until !== undefined && n.at > q.until) return false;
  if (q.media === 'only' && !n.media.length) return false;
  if (q.media === 'none' && n.media.length) return false;
  if (q.replies === false && n.re) return false;
  const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((x) => hay(n).includes(x))) return false;
  const follows = w.state.following.has(pk) || pk === me;
  switch (q.source) {
    case 'home':
      return (
        follows ||
        (q.reposts !== false && n.reposts.some((r) => w.state.following.has(r.by.author.pubkey)))
      );
    case 'global':
    case 'relay':
      return true;
    case 'profile':
      return pk === (q.pubkey ?? byRef(q.ref ?? '')?.author.pubkey);
    case 'hashtag':
      return n.segments.some(
        (s) => s.k === 'hashtag' && s.tag.toLowerCase() === q.tag?.toLowerCase(),
      );
    case 'search':
      return words.length > 0;
    case 'bookmarks':
      return w.state.bookmarks.has(n.id);
    case 'list':
      return (LISTS[q.tag ?? ''] ?? []).includes(n.by.handle);
    default:
      return false;
  }
}

function thread(w: World, q: Query, me: string): Entry[] {
  const id =
    q.id ??
    (q.ref?.startsWith('note1')
      ? w.notes.find((n) => q.ref === `note1${n.id.slice(0, 58)}`)?.id
      : undefined);
  const focus = w.byId.get(id ?? '');
  if (!focus) return [];
  const up: MNote[] = [];
  for (
    let p = focus.re ? w.byId.get(focus.re) : undefined;
    p;
    p = p.re ? w.byId.get(p.re) : undefined
  )
    up.unshift(p);
  const out: Entry[] = up.map((n) => entry(w, n, { me, thread: { role: 'ancestor', depth: 0 } }));
  out.push(entry(w, focus, { me, thread: { role: 'focus', depth: 0 } }));
  const walk = (parent: string, depth: number): void => {
    for (const n of w.repliesTo(parent)) {
      if (w.isMuted(n)) continue;
      out.push(entry(w, n, { me, thread: { role: 'reply', depth } }));
      walk(n.id, Math.min(depth + 1, 4));
    }
  };
  walk(focus.id, 1);
  return out;
}

export const entry = (w: World, n: MNote, o: RowOpts): Entry => ({
  key: n.id,
  row: () => noteRow(w, n, o),
});
const fixed = (row: Row): Entry => ({ key: row.key, row: () => row });

export function select(w: World, q: Query, me: string): Entry[] {
  const rows = finite(w, q);
  if (rows) return rows.map(fixed);
  if (q.source === 'thread') return thread(w, q, me);
  if (q.source === 'followers' || q.source === 'following') {
    const of = q.pubkey ?? me;
    const set = q.source === 'following' ? w.state.following : FOLLOWERS;
    // Only the reader's own lists are real in the mock; other people get a rotated slice of everyone.
    const people =
      of === me
        ? PEOPLE.filter((p) => set.has(p.author.pubkey))
        : PEOPLE.filter(
            (p, i) =>
              p.author.pubkey !== of &&
              (i + of.charCodeAt(2)) % (q.source === 'following' ? 2 : 3) === 0,
          );
    return people.map((p) => ({ key: p.author.pubkey, row: () => personRow(w, p, me) }));
  }
  const opts: RowOpts = { me, reposts: q.reposts };
  const notes = w.notes.filter((n) => matches(w, q, n, me)).map((n) => entry(w, n, opts));
  if (q.source === 'profile') {
    const p = byPubkey(q.pubkey ?? '') ?? byRef(q.ref ?? '');
    return p
      ? [{ key: `profile:${p.author.pubkey}`, row: () => profileRow(w, p, me) }, ...notes]
      : [];
  }
  if (q.source === 'search') {
    const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const people = words.length
      ? PEOPLE.filter((p) =>
          words.every((x) =>
            `${p.author.name} ${p.handle} ${p.author.nip05 ?? ''}`.toLowerCase().includes(x),
          ),
        )
      : [];
    return [
      ...people.map((p) => ({ key: p.author.pubkey, row: () => personRow(w, p, me) })),
      ...notes,
    ];
  }
  return notes;
}
