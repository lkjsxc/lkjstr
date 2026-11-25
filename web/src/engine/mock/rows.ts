// View models of the mock world: the rows exactly as the real engine will hand them over.

import { groupReactions } from '../../shared/reactions.ts';
import type {
  Author,
  NoteRow,
  PersonRow,
  ProfileEdit,
  ProfileRow,
  Quote,
  Reaction,
} from '../protocol.ts';
import { banner } from './art.ts';
import { HANDLERS } from './client-handlers.ts';
import type { ProfileAct } from './fixtures-acts.ts';
import { previewFixtures } from './fixtures-previews.ts';
import { hiddenOf } from './hidden.ts';
import { FOLLOWERS, type Person, SELF } from './people.ts';
import type { MNote, World } from './world.ts';

const firstLine = (text: string): string => (text.split('\n')[0] ?? '').slice(0, 120);
export const noteExcerpt = (note: MNote): string =>
  note.cw === undefined ? firstLine(note.text) : '';

export function reactionsOf(n: MNote): Reaction[] {
  return groupReactions(
    [...n.reactions].map(([key, r]) => ({
      emoji: r.emoji ?? key,
      url: r.url,
      address: r.address,
      set: r.set,
      count: r.count,
      mine: r.mine,
    })),
  );
}

function quoteOf(w: World, id: string): Quote {
  const q = w.byId.get(id);
  if (!q) return { state: 'missing', id };
  if (q.hidden || w.isMuted(q)) return { state: 'muted', id };
  return {
    state: 'ok',
    eventKind: q.eventKind,
    id,
    author: q.by.author,
    at: q.at,
    segments: q.segments,
    media: q.media,
    cw: q.cw,
    previews: w.linkPreviews ? previewFixtures(q.segments) : undefined,
    nextId: q.quote,
  };
}

export type RowOpts = {
  /** The reader's account. */
  me: string;
  reposts?: boolean;
  activity?: ProfileAct;
  /** In a thread the parent is in view: no reply context line. */
  thread?: NoteRow['thread'];
};

export function noteRow(w: World, n: MNote, o: RowOpts): NoteRow {
  const parent = n.re ? w.byId.get(n.re) : undefined;
  const shown = o.reposts === false || o.thread ? [] : n.reposts;
  return {
    previews: w.linkPreviews ? previewFixtures(n.segments) : undefined,
    kind: 'note',
    eventKind: n.eventKind,
    face: n.face,
    copyLink: n.copyLink,
    key: n.id,
    id: n.id,
    bech32: `note1${n.id.slice(0, 58)}`,
    author: n.by.author,
    at: o.activity?.at ?? n.at,
    act: o.activity?.act,
    actOn: o.activity?.actOn,
    segments: n.segments,
    media: n.media,
    quotes: n.quote ? [quoteOf(w, n.quote)] : [],
    replyTo:
      parent && !parent.hidden && !o.thread
        ? { id: parent.id, author: parent.by.author, excerpt: noteExcerpt(parent) }
        : undefined,
    repostedBy:
      o.activity?.act?.type === 'repost'
        ? { actors: [o.activity.act.actor], others: 0, at: o.activity.at }
        : shown.length
          ? {
              actors: shown.slice(0, 2).map((r) => r.by.author),
              others: Math.max(0, shown.length - 2),
              at: shown[0]?.at ?? n.at,
            }
          : undefined,
    cw: n.cw,
    counts: {
      replies: w.repliesTo(n.id).length,
      reposts: n.reposts.length + (n.mineReposted ? 1 : 0),
      reactions: [...n.reactions.values()].reduce((s, r) => s + r.count, 0),
      zaps: n.zaps,
      zapState: 'ready',
      zapUnverified: 0,
      zapAmountMsat: String(n.zaps * 1000),
      zapLimited: false,
      partial: n.partial,
    },
    reactions: reactionsOf(n),
    mine: {
      reposted: n.mineReposted,
      bookmarked: w.state.bookmarks.has(n.id),
      own: n.by.author.pubkey === o.me,
    },
    ...hiddenOf(n.hidden),
    thread: o.thread,
    client: n.client,
    clientAddress: n.client ? HANDLERS[n.client]?.address : undefined,
    pending: n.pending,
    unconfirmed: n.unconfirmed,
    channel: n.channel
      ? { id: n.channel, name: w.state.channels.find((c) => c.id === n.channel)?.name ?? '' }
      : undefined,
  };
}

export function profileRow(w: World, p: Person, me: string, writable = false): ProfileRow {
  const pk = p.author.pubkey;
  const mine = w.notes.filter((n) => n.by === p && !n.channel);
  const known = [...w.state.following]
    .filter((f) => f !== pk && (f.charCodeAt(3) + pk.charCodeAt(5)) % 3 === 0)
    .map((f) => w.notes.find((n) => n.by.author.pubkey === f)?.by.author)
    .filter((a): a is Author => Boolean(a));
  return {
    kind: 'profile',
    key: `profile:${pk}`,
    author: { ...p.author, muted: w.state.mutes.some((m) => m.k === 'person' && m.pubkey === pk) },
    banner: bannerOf(p),
    about: w.byId.size ? segmentAbout(p.about) : [],
    website: p.website,
    lud16: p.lud16,
    following: 40 + ((p.hue * 7) % 400),
    followers: 120 + ((p.hue * 13) % 5000),
    notes: mine.length,
    partial: p.hue % 2 === 0,
    followed: w.state.following.has(pk),
    followsYou: FOLLOWERS.has(pk) && pk !== me,
    self: pk === me,
    muted: w.state.mutes.some((m) => m.k === 'person' && m.pubkey === pk),
    knownFollowers:
      pk === me || !known.length
        ? undefined
        : { actors: known.slice(0, 3), others: Math.max(0, known.length - 3) },
    updatedAt: w.base - (p.hue + 3) * 3_600_000,
    since: w.base - (400 + p.hue) * 86_400_000,
    relays: ['relay.example.jp', 'nos.example.net', 'relay.fischer.example'].slice(
      0,
      1 + (p.hue % 3),
    ),
    edit: writable && pk === me ? profileEdit(p) : undefined,
  };
}
const bannerOf = (p: Person): string | undefined =>
  p.banner !== undefined ? p.banner || undefined : p.author.picture ? banner(p.hue) : undefined;
/** The reader's own fields as published (the mock keeps About as plain text). */
const profileEdit = (p: Person): ProfileEdit => ({
  name: p.author.name,
  about: p.about,
  picture: p.author.picture,
  banner: bannerOf(p),
  nip05: p.author.nip05,
  website: p.website,
  lud16: p.lud16,
});
/** The header of someone whose profile has not arrived: nothing is known, so no count is given. */
export const pendingProfile = (author: Author): ProfileRow => ({
  kind: 'profile',
  key: `profile:${author.pubkey}`,
  author,
  about: [],
  partial: true,
  followed: false,
  followsYou: false,
  self: false,
  muted: false,
  relays: [],
});
const segmentAbout = (text: string): ProfileRow['about'] => [{ k: 'text', text }];

export function personRow(w: World, p: Person, me: string): PersonRow {
  const pk = p.author.pubkey;
  return {
    kind: 'person',
    key: pk,
    author: p.author,
    about: firstLine(p.about),
    followed: w.state.following.has(pk),
    followsYou: FOLLOWERS.has(pk) && pk !== me,
    self: pk === me,
  };
}
export const ME = SELF.author.pubkey;
