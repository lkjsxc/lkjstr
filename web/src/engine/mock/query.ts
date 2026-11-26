// Which rows a query shows, in order. The mock materialises whole lists; the real engine pages its store.
import type { Query, Row } from '../protocol.ts';
import { stranger } from './accounts.ts';
import { channelHeader, channelList, channelOf } from './channels.ts';
import { profileAct } from './fixtures-acts.ts';
import { finite, notifications } from './lists.ts';
import { byPubkey, byRef, FOLLOWERS, PEOPLE, type Person } from './people.ts';
import { relayHead, servedBy } from './relays.ts';
import { noteRow, pendingProfile, personRow, profileRow, type RowOpts } from './rows.ts';
import { matchesLanguage, searchPeople } from './search.ts';
import type { MNote, World } from './world.ts';

/** One row of a subscription's list: built when it is sent, so it always shows the current state. */
export type Entry = { readonly key: string; row(): Row };

const LISTS: Record<string, readonly string[]> = {
  photographers: ['aoi', 'marco', 'ichiro', 'mio'],
};
const hay = (n: MNote): string => `${n.text} ${n.by.author.name}`.toLowerCase();

/** Whether `typed` (a name, a handle, an npub, a NIP-05 name) names this person. */
const named = (p: Person, typed: string): boolean => {
  const x = typed.toLowerCase();
  const a = p.author;
  return (
    a.npub === x ||
    p.handle === x ||
    a.name.toLowerCase().includes(x) ||
    (a.nip05 ?? '').toLowerCase().startsWith(x)
  );
};
/** A profile's list by kind. Who reacted to what is not part of the mock world: the reader's own reactions are
 * real, another person's are a fixed made-up slice. */
function ofProfile(w: World, q: Query, n: MNote, who: string | undefined, me: string): boolean {
  if (q.show === 'articles') return n.by.author.pubkey === who && n.eventKind === 30023;
  if (q.show === 'lists')
    return (
      n.by.author.pubkey === who &&
      [
        3, 10000, 10001, 10002, 10003, 10015, 10030, 30000, 30002, 30003, 30004, 30005, 30015,
        30030, 39089,
      ].includes(n.eventKind ?? 1)
    );
  if (q.show === 'all') return n.by.author.pubkey === who;
  if (n.eventKind !== undefined) return false;
  if (profileAct(w, q, n)) return true;
  const pk = n.by.author.pubkey;
  if (q.show === 'reposts') return n.reposts.some((r) => r.by.author.pubkey === who);
  if (q.show === 'reactions')
    return who === me
      ? [...n.reactions.values()].some((r) => r.mine)
      : pk !== who && Number.parseInt(n.id.slice(0, 4), 16) % 5 === 0;
  if (pk !== who) return false;
  if (q.show === 'posts') return !n.re;
  if (q.show === 'replies') return Boolean(n.re);
  return q.show === 'media' ? n.media.length > 0 : true;
}

/** Whether a note belongs to a note query (thread aside). */
export function matches(w: World, q: Query, n: MNote, me: string): boolean {
  const pk = n.by.author.pubkey;
  // A channel message (kind 42) is no note of the timelines: it shows in its channel, and among bookmarks.
  if (Boolean(n.channel) !== (q.source === 'channel') && q.source !== 'bookmarks') return false;
  if (n.eventKind !== undefined && q.source !== 'profile' && q.source !== 'bookmarks') return false;
  if (w.isMuted(n) && q.source !== 'profile') return false;
  if (q.authors?.length && !q.authors.includes(pk)) return false;
  const at = profileAct(w, q, n)?.at ?? n.at;
  if (q.since !== undefined && at < q.since) return false;
  if (q.until !== undefined && at > q.until) return false;
  if (q.media === 'only' && !n.media.length) return false;
  if (q.media === 'none' && n.media.length) return false;
  if (q.replies === false && n.re) return false;
  if (!matchesLanguage(n, q.language)) return false;
  const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const text = hay(n);
  if (!words.every((x) => text.includes(x))) return false;
  if (q.phrases?.some((x) => !text.includes(x.toLowerCase()))) return false;
  if (q.exclude?.some((x) => text.includes(x.toLowerCase()))) return false;
  const lacks = (k: 'image' | 'video' | 'link'): boolean =>
    k === 'link' ? !n.segments.some((s) => s.k === 'link') : !n.media.some((m) => m.type === k);
  if (q.has?.some(lacks)) return false;
  if (q.from?.length && !q.from.some((x) => named(n.by, x))) return false;
  const follows = w.state.following.has(pk) || pk === me;
  switch (q.source) {
    case 'their-home': {
      const of = q.pubkey ?? byRef(q.ref ?? '')?.author.pubkey ?? '';
      const follows =
        of === me
          ? w.state.following
          : new Set(
              PEOPLE.filter(
                (p, i) => p.author.pubkey !== of && (i + of.charCodeAt(2)) % 2 === 0,
              ).map((p) => p.author.pubkey),
            );
      return (
        follows.has(pk) ||
        (q.reposts !== false && n.reposts.some((r) => follows.has(r.by.author.pubkey)))
      );
    }
    case 'home':
      return (
        follows ||
        (q.reposts !== false && n.reposts.some((r) => w.state.following.has(r.by.author.pubkey)))
      );
    case 'global':
      return true;
    case 'relay':
      return servedBy(q.relay ?? '', n.id);
    case 'profile':
      return ofProfile(w, q, n, q.pubkey ?? byRef(q.ref ?? '')?.author.pubkey, me);
    case 'hashtag':
      return n.segments.some(
        (s) => s.k === 'hashtag' && s.tag.toLowerCase() === q.tag?.toLowerCase(),
      );
    case 'search':
      return words.length > 0 || Boolean(q.phrases?.length || q.from?.length || q.has?.length);
    case 'bookmarks':
      return w.state.bookmarks.has(n.id);
    case 'channel':
      return n.channel === channelOf(w, q)?.id;
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
  const answers = (n: MNote) => (n.re ? { parent: n.re } : {});
  const out: Entry[] = up.map((n) =>
    entry(w, n, { me, thread: { role: 'ancestor', depth: 0, ...answers(n) } }),
  );
  out.push(entry(w, focus, { me, thread: { role: 'focus', depth: 0, ...answers(focus) } }));
  const walk = (parent: string, depth: number): void => {
    for (const n of w.repliesTo(parent)) {
      if (w.isMuted(n)) continue;
      out.push(entry(w, n, { me, thread: { role: 'reply', depth, parent } }));
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

export function select(w: World, q: Query, me: string, profileWritable = false): Entry[] {
  // Signed out, what belongs to an account is empty, as it is in the real engine.
  if (!me && ['home', 'notifications', 'bookmarks', 'mutes', 'emoji'].includes(q.source)) return [];
  if (q.source === 'people') {
    const norm = (s: string) => s.normalize('NFKC').toLowerCase();
    const needle = norm(q.text ?? '');
    const thread = w.notes
      .filter((n) => n.id === q.id || n.re === q.id)
      .map((n) => n.by.author.pubkey);
    // A bare @ (empty text, as in the engine): the target's author, the thread's people, then follows; never me.
    if (!q.authors && !q.ref && q.text === '') {
      const target = w.notes.find((n) => n.id === q.id)?.by.author.pubkey;
      const rank = (p: Person) =>
        p.author.pubkey === target ? 0 : thread.includes(p.author.pubkey) ? 1 : 2;
      return PEOPLE.filter(
        (p) =>
          p.author.pubkey !== me &&
          (thread.includes(p.author.pubkey) || w.state.following.has(p.author.pubkey)),
      )
        .sort((a, b) => rank(a) - rank(b) || norm(a.author.name).localeCompare(norm(b.author.name)))
        .slice(0, 6)
        .map((p) => fixed(personRow(w, p, me)));
    }
    return PEOPLE.filter((p) =>
      q.authors
        ? q.authors.includes(p.author.pubkey)
        : q.ref
          ? byRef(q.ref.replace(/^nostr:/, '')) === p
          : !!needle &&
            [p.author.name, p.handle, p.author.nip05 ?? ''].some((v) => norm(v).startsWith(needle)),
    )
      .sort((a, b) => {
        const rank = (p: Person) =>
          w.state.following.has(p.author.pubkey) ? 0 : thread.includes(p.author.pubkey) ? 1 : 2;
        return rank(a) - rank(b) || norm(a.author.name).localeCompare(norm(b.author.name));
      })
      .slice(0, q.authors ? 32 : 6)
      .map((p) => fixed(personRow(w, p, me)));
  }
  const rows = finite(w, q);
  if (rows) return rows.map(fixed);
  if (q.source === 'thread') return thread(w, q, me);
  if (q.source === 'channels') return channelList(w, q, me);
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
  const time = (n: MNote): number =>
    q.source === 'profile' && q.show === 'all'
      ? n.at
      : (profileAct(w, q, n)?.at ?? (q.reposts === false ? n.at : (n.reposts[0]?.at ?? n.at)));
  const kept = w.notes
    .filter((n) => matches(w, q, n, me))
    .sort((a, b) => time(b) - time(a) || b.id.localeCompare(a.id));
  const notes = kept.map((n) =>
    entry(w, n, {
      ...opts,
      activity: q.source === 'profile' && q.show === 'all' ? undefined : profileAct(w, q, n),
    }),
  );
  if (
    q.notifications &&
    me &&
    (q.source === 'home' || q.source === 'global' || q.source === 'their-home')
  ) {
    // Notifications flow in at their own time; one whose note is already in the list is left out.
    const ids = new Set(kept.map((n) => n.id));
    const news = notifications(w, { source: 'notifications', account: me })
      .filter((r) => !r.note || !ids.has(r.note.id))
      .sort((a, b) => b.at - a.at);
    const out: Entry[] = [];
    let i = 0;
    kept.forEach((n, at) => {
      for (; i < news.length && (news[i]?.at ?? 0) >= n.at; i++) out.push(fixed(news[i] as Row));
      out.push(notes[at] as Entry);
    });
    return [...out, ...news.slice(i).map(fixed)];
  }
  if (q.source === 'channel') {
    const c = channelOf(w, q);
    return c ? [channelHeader(w, c, me), ...notes] : [];
  }
  if (q.source === 'profile') {
    const writable = profileWritable && q.account === me;
    const p = byPubkey(q.pubkey ?? '') ?? byRef(q.ref ?? '');
    if (p)
      return [
        { key: `profile:${p.author.pubkey}`, row: () => profileRow(w, p, me, writable) },
        ...notes,
      ];
    // A key nobody here knows: the header as it is before any metadata has arrived.
    const named = q.pubkey ?? q.ref ?? '';
    const unknown = /^([0-9a-f]{64}|npub1[a-z0-9]{20,})$/.test(named) ? stranger(named) : undefined;
    return unknown ? [fixed(pendingProfile(unknown))] : [];
  }
  if (q.source === 'relay' && q.relay) {
    const admin = PEOPLE[0]?.author;
    return [{ key: `relay:${q.relay}`, row: () => relayHead(w, q.relay ?? '', admin) }, ...notes];
  }
  if (q.source === 'search') return [...searchPeople(w, q, me), ...notes];
  return notes;
}
