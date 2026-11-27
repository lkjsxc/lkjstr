import type { GenericFace, Media, MuteTarget, Segment } from '../protocol.ts';
import { avatar, hueColor, photo } from './art.ts';
import type { MChannel } from './channels.ts';
import { CHANNEL_FILLER, CHANNEL_NOTES, CHANNELS } from './fixtures-channels.ts';
import { addGenericFixtures } from './fixtures-generic.ts';
import { toneUrl, VIDEO, VIDEO_URL } from './fixtures-media.ts';
import { FILLER, type MediaSpec, NOTES, type NoteSpec } from './fixtures-notes.ts';
import { byHandle, EMOJI, FOLLOWING, PEOPLE, type Person } from './people.ts';
import { collisionChips, initialReactions, type React } from './reactions.ts';
import { initialRelays } from './relays.ts';
export type MNote = {
  eventKind?: number;
  face?: GenericFace;
  copyLink?: string;
  readonly id: string;
  readonly by: Person;
  readonly at: number;
  readonly text: string;
  readonly languages?: readonly string[]; // Explicit language-label fixture values.
  readonly segments: Segment[];
  readonly media: Media[];
  readonly re?: string;
  readonly quote?: string;
  readonly cw?: string;
  reposts: { by: Person; at: number }[];
  reactions: Map<string, React>; // bound: the distinct emoji used on one note
  zaps: number;
  partial: boolean;
  mineReposted: boolean;
  readonly hidden?: string;
  readonly client?: string;
  pending?: boolean;
  unconfirmed?: boolean;
  /** A channel message (kind 42): the channel's id. */
  readonly channel?: string;
};
const MIN = 60_000;
/** A made-up event id: 64 hex characters from a small generator seeded by `n` (distinct for distinct `n`). */
export const idOf = (n: number): string => {
  let x = (n + 1) * 2654435761;
  return Array.from({ length: 64 }, (_, i) => {
    x = (Math.imul(x ^ (x >>> 15), 2246822519) + i) | 0;
    return i < 8 ? ((n >>> (28 - i * 4)) & 15).toString(16) : ((x >>> 8) & 15).toString(16);
  }).join('');
};

const TOKEN =
  /((?:nostr:)?(?:npub1|nprofile1)[a-z0-9]+)|(https?:\/\/[^\s]+)|#([\p{L}\p{N}_]+)|@([a-z][a-z-]*)|:([a-z0-9_-]+):/gu;
const linkText = (url: string): string => {
  const u = new URL(url);
  const path = u.pathname === '/' ? '' : u.pathname;
  return u.host + (path.length > 24 ? `${path.slice(0, 22)}…` : path);
};
/** Splits note text the way the engine hands it over. */
export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const push = (s: string): void => void (s && out.push({ k: 'text', text: s }));
  for (const m of text.matchAll(TOKEN)) {
    const [whole, ref, url, tag, handle, code] = m;
    const person = ref
      ? PEOPLE.find((p) => p.author.npub === ref.replace(/^nostr:/, ''))
      : handle
        ? PEOPLE.find((p) => p.handle === handle)
        : undefined;
    let seg: Segment | undefined;
    if (person) seg = { k: 'mention', pubkey: person.author.pubkey, name: person.author.name };
    else if (url) seg = { k: 'link', url, text: linkText(url) };
    else if (tag) seg = { k: 'hashtag', tag };
    else if (code && EMOJI[code]) seg = { k: 'emoji', code, url: EMOJI[code] };
    if (!seg) continue;
    push(text.slice(last, m.index));
    out.push(seg);
    last = m.index + whole.length;
  }
  push(text.slice(last));
  return out;
}
export const media = ([w, h, hue, alt]: MediaSpec, sensitive: boolean): Media => ({
  type: 'image',
  url: photo(w, h, hue),
  w,
  h,
  alt,
  color: hueColor(hue),
  sensitive: sensitive || undefined,
});

const clip = ([type, alt]: NonNullable<NoteSpec['clip']>, sensitive: boolean): Media =>
  type === 'video'
    ? {
        type,
        url: VIDEO_URL,
        w: VIDEO.w,
        h: VIDEO.h,
        alt,
        color: '#9fb8cf',
        sensitive: sensitive || undefined,
      }
    : { type, url: toneUrl(), alt, sensitive: sensitive || undefined };

/** Notes that involve the reader, so notifications and the reader's own profile have something to show. */
const OWN: readonly NoteSpec[] = [
  {
    by: 'komorebi',
    ago: 75,
    tag: 'tiles',
    text: 'タイル型のクライアント、スレッドを隣に開いたまま読めるのが思ったより快適です。',
    reactions: [
      ['+', 2],
      ['', 1],
      ['-', 1],
      ['❤️', 7],
      [':otsu:', 2],
    ],
    reposts: ['aoi', 'taro'],
    zaps: 2100,
  },
  {
    by: 'aoi',
    ago: 70,
    re: 'tiles',
    text: '@komorebi わかります。タイムラインを見失わないのがいいですよね。',
  },
  {
    by: 'sam',
    ago: 45,
    text: 'Thanks @komorebi for the bug report on the linter. Fixed in 0.1.1, with a test this time.',
  },
  {
    by: 'komorebi',
    ago: 420,
    tag: 'quiet',
    text: '通知の少ない一日。こういう日は長い文章が読めます。',
    reactions: [['❤️', 4]],
  },
  {
    by: 'komorebi',
    ago: 900,
    text: 'Reading the relay list spec again. Short lists are kind lists.\n#nostr',
    reactions: [
      ['❤️', 3],
      ['🤝', 1],
    ],
  },
];

export type World = ReturnType<typeof createWorld>;

export function createWorld(now: number) {
  const base = Math.floor(now / MIN) * MIN;
  const notes: MNote[] = []; // bound: the fixtures plus what arrives during one session
  const byId = new Map<string, MNote>(); // bound: as `notes`
  const tags = new Map<string, string>(); // bound: tagged fixtures
  let serial = 0;
  const specs = [...NOTES, ...OWN];
  for (const [i, s] of specs.entries()) if (s.tag) tags.set(s.tag, idOf(i + 1));
  const make = (s: NoteSpec, id: string, at: number): MNote => ({
    id,
    by: byHandle(s.by),
    at,
    text: s.text,
    segments: segment(s.text),
    media: [
      ...(s.media ?? []).map((m) => media(m, s.cw !== undefined)),
      ...(s.clip ? [clip(s.clip, s.cw !== undefined)] : []),
    ],
    re: s.re ? tags.get(s.re) : undefined,
    quote: s.quote ? tags.get(s.quote) : undefined,
    cw: s.cw,
    reposts: (s.reposts ?? []).map((h, k) => ({ by: byHandle(h), at: at + (9 - k) * 20_000 })),
    reactions: initialReactions(s.reactions ?? []),
    zaps: s.zaps ?? 0,
    partial: false,
    mineReposted: false,
    hidden: s.hidden,
    client: s.client,
  });
  const add = (n: MNote): MNote => {
    notes.push(n);
    byId.set(n.id, n);
    return n;
  };
  for (const [i, s] of specs.entries()) add(make(s, idOf(i + 1), base - s.ago * MIN));
  collisionChips(notes[0]?.reactions);
  // Older notes, generated: four weeks of them, so the time rail has days across a month start.
  for (let i = 0; i < 420; i++) {
    const [by, text] = FILLER[(i * 7) % FILLER.length] ?? ['aoi', ''];
    const at = base - (800 + i * 96 + ((i * 37) % 9)) * MIN;
    const n = add(make({ by, ago: 0, text }, idOf(1000 + i), at));
    if (i % 3 === 0) n.reactions.set('❤️', { count: 1 + (i % 12), mine: false });
    if (i % 17 === 0) n.media.push(media([1600, 900, (i * 23) % 360], false));
  }
  // Channels: ids from 9000, their messages from 9100, older generated chat in the first one from 9300.
  const channelId = new Map(CHANNELS.map((c, i) => [c.key, idOf(9000 + i)]));
  for (const [i, [, , , , tag]] of CHANNEL_NOTES.entries()) if (tag) tags.set(tag, idOf(9100 + i));
  for (const [i, [key, by, ago, text, , re]] of CHANNEL_NOTES.entries())
    add({
      ...make({ by, ago, text, re }, idOf(9100 + i), base - ago * MIN),
      channel: channelId.get(key),
    });
  for (let i = 0; i < 90; i++) {
    const [by, text] = CHANNEL_FILLER[(i * 3) % CHANNEL_FILLER.length] ?? ['taro', ''];
    const at = base - (200 + i * 47 + ((i * 13) % 11)) * MIN;
    add({ ...make({ by, ago: 0, text }, idOf(9300 + i), at), channel: idOf(9000) });
  }
  // Historical fixture notes make out-of-window month seeks observable in development and smoke.
  for (let i = 0; i < 80; i++) {
    const at = Date.UTC(
      new Date(base).getUTCFullYear() - 1 - Math.floor(i / 12),
      11 - (i % 12),
      15,
    );
    add(make({ by: 'taro', ago: 0, text: `Archive fixture ${i}` }, idOf(9500 + i), at));
  }
  // Old-day header regression: the name must fit beside an HH:mm time on a phone.
  const historical = make(
    { by: 'taro', ago: 0, text: 'Historical name fixture' },
    idOf(9600),
    Date.UTC(new Date(base).getUTCFullYear() - 8, 0, 15),
  );
  add({
    ...historical,
    by: {
      ...historical.by,
      author: { ...historical.by.author, name: 'AlexandriaRose', nip05: undefined },
    },
  });
  addGenericFixtures(base, MIN, idOf, make, add);
  notes.sort((a, b) => b.at - a.at);
  const state = {
    notificationSeen: base - 60 * MIN,
    following: new Set(FOLLOWING),
    pins: new Map<string, Set<string>>(), // bound: fixture authors and their note IDs
    bookmarks: new Set(
      [tags.get('nip11'), tags.get('river'), tags.get('lint')].filter(Boolean) as string[],
    ),
    mutes: [
      { k: 'word', word: 'airdrop' },
      { k: 'hashtag', tag: 'giveaway' },
      { k: 'person', pubkey: byHandle('marco').author.pubkey },
    ] as MuteTarget[],
    servers: ['https://media.example.jp', 'https://blossom.example.net'],
    relays: initialRelays(),
    channels: CHANNELS.map(
      (c, i): MChannel => ({
        id: idOf(9000 + i),
        name: c.name,
        about: c.about,
        picture: c.hue === undefined ? undefined : avatar(c.hue, i),
        by: c.name ? byHandle(c.by) : undefined,
      }),
    ),
    /** The reader's list of channels, in its order. */
    joined: CHANNELS.flatMap((c, i) => (c.joined ? [idOf(9000 + i)] : [])),
    /** When the reader last saw each channel. Bound: the channels. */
    seen: new Map(
      CHANNELS.flatMap((c, i) =>
        c.seenAgo === undefined ? [] : [[idOf(9000 + i), base - c.seenAgo * MIN] as const],
      ),
    ),
    /** How relays the reader added answered. Bound: the relays added in one session. */
    met: new Map<string, 'connected' | 'failed'>(),
  };

  return {
    linkPreviews: true,
    customEmoji: true, // off: the mock's `emoji: 'none'`, a reader with no custom emoji list
    base,
    notes,
    byId,
    tags,
    state,
    repliesTo: (id: string): MNote[] =>
      notes.filter((n) => n.re === id).sort((a, b) => a.at - b.at),
    arrive(by: Person, text: string, at: number, extra: Partial<MNote> = {}): MNote {
      const n: MNote = {
        ...make({ by: by.handle, ago: 0, text }, idOf(5000 + serial++), at),
        ...extra,
      };
      notes.unshift(n);
      byId.set(n.id, n);
      return n;
    },
    remove(id: string): void {
      const i = notes.findIndex((n) => n.id === id);
      if (i >= 0) notes.splice(i, 1);
      byId.delete(id);
    },
    isMuted(n: MNote): boolean {
      return state.mutes.some((m) => {
        if (m.k === 'person') return m.pubkey === n.by.author.pubkey;
        if (m.k === 'word') return n.text.toLowerCase().includes(m.word.toLowerCase());
        if (m.k === 'hashtag') return n.segments.some((s) => s.k === 'hashtag' && s.tag === m.tag);
        return m.id === n.id || m.id === n.re;
      });
    },
  };
}
