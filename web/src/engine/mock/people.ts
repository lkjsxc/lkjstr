// The people of the mock world. Keys are made up (not valid bech32): the mock resolves them by table.
import type { Author, Emoji } from '../protocol.ts';
import { avatar, emojiTile } from './art.ts';

export const EMOJI: Record<string, string> = {
  neko: emojiTile('猫', 28),
  sakura: emojiTile('桜', 340),
  otsu: emojiTile('乙', 200),
  kusa: emojiTile('草', 130),
  nostr: emojiTile('N', 270),
  ok: emojiTile('可', 160),
};
export const emojiOf = (text: string): Emoji[] =>
  [...new Set([...text.matchAll(/:([a-z0-9_]+):/g)].map((m) => m[1] ?? ''))]
    .filter((code) => EMOJI[code])
    .map((code) => ({ code, url: EMOJI[code] ?? '' }));

export type Person = {
  readonly handle: string;
  readonly author: Author;
  readonly about: string;
  readonly hue: number;
  readonly website?: string;
  readonly lud16?: string;
};

const hex = (n: number): string =>
  Array.from({ length: 64 }, (_, i) =>
    ((n * 7 + i * 13 + (((n + 3) * i) % 11)) % 16).toString(16),
  ).join('');
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const npub = (n: number): string =>
  `npub1${Array.from({ length: 58 }, (_, i) => B32[(n * 5 + i * 7 + (((n + 1) * i) % 13)) % 32]).join('')}`;

type Spec = [
  handle: string,
  name: string,
  about: string,
  hue: number,
  nip05?: string,
  pic?: boolean,
];
const SPECS: Spec[] = [
  [
    'komorebi',
    '木漏れ日',
    '読む人。たまに書く人。静かなタイムラインが好きです。',
    150,
    'komorebi@example.jp',
  ],
  [
    'aoi',
    '高橋 葵',
    '写真と散歩。朝の光を撮っています。\nフィルムとデジタルの両方。',
    205,
    'aoi@example.jp',
  ],
  [
    'kenji',
    '佐藤健二 :neko:',
    '猫とリレーの世話をしています。wss://relay.example.jp の中の人。',
    28,
    'kenji@relay.example.jp',
  ],
  ['mio', 'みお', '絵を描きます。お仕事の依頼は DM まで。', 320, undefined],
  [
    'taro',
    '山田太郎',
    'エンジニア。Rust と自宅サーバー。発言は個人の見解です。',
    250,
    'taro@example.jp',
  ],
  [
    'lena',
    'Lena Fischer',
    'Type designer in Berlin. Letters, bicycles, long walks.',
    12,
    'lena@fischer.example',
  ],
  [
    'sam',
    'Sam Rivera',
    'Building small tools for the open web. Coffee first.',
    180,
    'sam@rivera.example',
  ],
  ['sakura', '田中 さくら :sakura:', '和菓子と季節の話。週末は茶道。', 340, 'sakura@example.jp'],
  ['hiroshi', 'Hiroshi', 'Relay operator. Uptime is a love language.', 95, undefined],
  [
    'ada',
    'Ada Lovell',
    'Notes on protocols, gardens and old computers.',
    275,
    'ada@lovell.example',
  ],
  ['ichiro', '鈴木一郎', '登山と温泉。百名山は四十二座。', 60, undefined, false],
  ['priya', 'Priya N.', 'Cryptography student. I read specs for fun.', 300, 'priya@example.org'],
  ['yuki', 'ゆき', '日記。ねむい。', 190, undefined, false],
  ['marco', 'Marco', 'Fotografia analogica, pane fatto in casa. Sometimes English.', 40, undefined],
  ['akane', '小林 茜', '翻訳者（英日）。言葉のことをよく考えます。', 0, 'akane@example.jp'],
  [
    'devbot',
    'nostr-dev-bot',
    'Posts releases of Nostr software. Automated.',
    230,
    'bot@example.dev',
  ],
  ['komorebi-dev', '木漏れ日（開発）', '検証用のアカウントです。', 120, undefined, false],
];

export const PEOPLE: readonly Person[] = SPECS.map(([handle, name, about, hue, nip05, pic], i) => ({
  handle,
  about,
  hue,
  website: nip05 ? `https://${nip05.split('@')[1]}` : undefined,
  lud16: i % 3 === 1 ? `${handle}@wallet.example` : undefined,
  author: {
    pubkey: hex(i + 1),
    npub: npub(i + 1),
    name,
    emoji: emojiOf(name),
    picture: pic === false ? undefined : avatar(hue, i),
    nip05,
    verified: Boolean(nip05) && handle !== 'ada',
    bot: handle === 'devbot' || undefined,
  },
}));

export const byHandle = (handle: string): Person => {
  const p = PEOPLE.find((x) => x.handle === handle);
  if (!p) throw new Error(`mock: no person ${handle}`);
  return p;
};
export const byPubkey = (pubkey: string): Person | undefined =>
  PEOPLE.find((p) => p.author.pubkey === pubkey);
/** Resolves a reference as an address carries it: an npub, a handle or a NIP-05 name. */
export const byRef = (ref: string): Person | undefined =>
  PEOPLE.find((p) => p.author.npub === ref || p.handle === ref || p.author.nip05 === ref);

export const SELF = byHandle('komorebi');
export const SECOND = byHandle('komorebi-dev');
/** Who the reader follows, and who follows the reader. */
export const FOLLOWING = new Set(
  ['aoi', 'kenji', 'mio', 'taro', 'lena', 'sam', 'sakura', 'ada', 'ichiro', 'akane', 'devbot'].map(
    (h) => byHandle(h).author.pubkey,
  ),
);
export const FOLLOWERS = new Set(
  ['aoi', 'kenji', 'taro', 'lena', 'sakura', 'priya', 'yuki', 'akane'].map(
    (h) => byHandle(h).author.pubkey,
  ),
);
