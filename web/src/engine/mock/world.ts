// The state of the mock world: notes, who reposted and reacted, the reader's follows, bookmarks and mutes.
import type { Media, MuteTarget, Segment } from '../protocol.ts';
import { hueColor, photo } from './art.ts';
import { FILLER, type MediaSpec, NOTES, type NoteSpec } from './fixtures-notes.ts';
import { byHandle, EMOJI, FOLLOWING, PEOPLE, type Person } from './people.ts';

export type React = { count: number; mine: boolean };
export type MNote = {
  readonly id: string;
  readonly by: Person;
  readonly at: number;
  readonly text: string;
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

const TOKEN = /(https?:\/\/[^\s]+)|#([\p{L}\p{N}_]+)|@([a-z][a-z-]*)|:([a-z0-9_]+):/gu;
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
    const [whole, url, tag, handle, code] = m;
    const person = handle ? PEOPLE.find((p) => p.handle === handle) : undefined;
    let seg: Segment | undefined;
    if (url) seg = { k: 'link', url, text: linkText(url) };
    else if (tag) seg = { k: 'hashtag', tag };
    else if (person) seg = { k: 'mention', pubkey: person.author.pubkey, name: person.author.name };
    else if (code && EMOJI[code]) seg = { k: 'emoji', code, url: EMOJI[code] };
    if (!seg) continue;
    push(text.slice(last, m.index));
    out.push(seg);
    last = m.index + whole.length;
  }
  push(text.slice(last));
  return out;
}
const media = ([w, h, hue, alt]: MediaSpec, sensitive: boolean): Media => ({
  type: 'image',
  url: photo(w, h, hue),
  w,
  h,
  alt,
  color: hueColor(hue),
  sensitive: sensitive || undefined,
});

/** Notes that involve the reader, so notifications and the reader's own profile have something to show. */
const OWN: readonly NoteSpec[] = [
  {
    by: 'komorebi',
    ago: 75,
    tag: 'tiles',
    text: 'タイル型のクライアント、スレッドを隣に開いたまま読めるのが思ったより快適です。',
    reactions: [
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
    media: (s.media ?? []).map((m) => media(m, s.cw !== undefined)),
    re: s.re ? tags.get(s.re) : undefined,
    quote: s.quote ? tags.get(s.quote) : undefined,
    cw: s.cw,
    reposts: (s.reposts ?? []).map((h, k) => ({ by: byHandle(h), at: at + (9 - k) * 20_000 })),
    reactions: new Map(
      (s.reactions ?? []).map(([e, count, mine]) => [e, { count, mine: mine === true }]),
    ),
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
  // Older notes, generated: about three days of them.
  for (let i = 0; i < 420; i++) {
    const [by, text] = FILLER[(i * 7) % FILLER.length] ?? ['aoi', ''];
    const at = base - (800 + i * 11 + ((i * 37) % 9)) * MIN;
    const n = add(make({ by, ago: 0, text }, idOf(1000 + i), at));
    if (i % 3 === 0) n.reactions.set('❤️', { count: 1 + (i % 12), mine: false });
    if (i % 17 === 0) n.media.push(media([1600, 900, (i * 23) % 360], false));
  }
  notes.sort((a, b) => b.at - a.at);
  for (const [i, n] of notes.entries()) n.partial = i < 40 && i % 4 === 1;

  const state = {
    following: new Set(FOLLOWING),
    bookmarks: new Set(
      [tags.get('nip11'), tags.get('river'), tags.get('lint')].filter(Boolean) as string[],
    ),
    mutes: [
      { k: 'word', word: 'airdrop' },
      { k: 'hashtag', tag: 'giveaway' },
      { k: 'person', pubkey: byHandle('marco').author.pubkey },
    ] as MuteTarget[],
    servers: ['https://media.example.jp', 'https://blossom.example.net'],
  };

  return {
    base,
    notes,
    byId,
    tags,
    state,
    repliesTo: (id: string): MNote[] =>
      notes.filter((n) => n.re === id).sort((a, b) => a.at - b.at),
    /** A note that arrives now (live arrivals, or the reader's own post). */
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
