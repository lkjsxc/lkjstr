// The public chat channels of the mock world (NIP-28) and what was said in them. `ago` is minutes before the
// moment the mock starts; `seenAgo` is when the reader last looked (absent: never, or not joined).
export type ChannelSpec = {
  readonly key: string;
  /** '' for a channel whose metadata has not arrived. */
  readonly name: string;
  readonly about: string;
  readonly by: string;
  /** Hue of its picture; absent: no picture. */
  readonly hue?: number;
  readonly joined?: boolean;
  readonly seenAgo?: number;
};

export const CHANNELS: readonly ChannelSpec[] = [
  {
    key: 'nostr-ja',
    name: 'Nostr 日本語',
    about: '日本語で Nostr の話をする場所。はじめての人もどうぞ。',
    by: 'aoi',
    hue: 205,
    joined: true,
    seenAgo: 30,
  },
  {
    key: 'lkjstr',
    name: 'lkjstr',
    about: 'Questions and feedback about lkjstr.',
    by: 'komorebi',
    hue: 150,
    joined: true,
    seenAgo: 0,
  },
  {
    key: 'photo',
    name: '写真部',
    about: '撮った写真を見せ合う部屋。機材の話はほどほどに。',
    by: 'mio',
    joined: true,
    seenAgo: 300,
  },
  {
    key: 'relay-ops',
    name: 'Relay operators',
    about: 'Running relays: software, abuse handling, costs.',
    by: 'hiroshi',
    hue: 280,
  },
  { key: 'books', name: '読書会', about: '今月の一冊と、その感想。', by: 'sakura', hue: 330 },
  { key: 'dev', name: 'nostr-dev', about: 'NIPs, clients, libraries.', by: 'kenji', hue: 100 },
  { key: 'pending', name: '', about: '', by: 'priya' },
];

export type ChannelNoteSpec = readonly [
  channel: string,
  by: string,
  ago: number,
  text: string,
  /** A name another message answers with `re`. */
  tag?: string,
  re?: string,
];

export const CHANNEL_NOTES: readonly ChannelNoteSpec[] = [
  ['nostr-ja', 'kenji', 4, 'リレーを一つ増やしたら、ホームの抜けが減りました。'],
  ['nostr-ja', 'sakura', 9, 'おはようございます。今朝は冷えますね。', 'morning'],
  [
    'nostr-ja',
    'taro',
    12,
    '@sakura おはようございます。こちらは霜が降りました。',
    undefined,
    'morning',
  ],
  ['nostr-ja', 'aoi', 21, 'チャンネルの説明を少し直しました。はじめての人が迷わないように。'],
  ['nostr-ja', 'yuki', 34, 'NIP-28 って kind 42 が発言なんですね。やっと覚えた。', 'kind42'],
  ['nostr-ja', 'kenji', 36, 'そうです。kind 40 が作成、41 が説明の更新。', undefined, 'kind42'],
  ['nostr-ja', 'komorebi', 52, 'ここ、流れがゆっくりで読みやすいです。'],
  ['nostr-ja', 'akane', 95, '「リレー」の訳語、中継サーバーと書くべきか毎回迷います。'],
  ['nostr-ja', 'ichiro', 140, '山の上からでも投稿できました。電波一本。'],
  ['lkjstr', 'sam', 18, 'The tab search is the thing I did not know I wanted.', 'tabsearch'],
  ['lkjstr', 'komorebi', 16, 'Glad to hear it. One key, then type.', undefined, 'tabsearch'],
  [
    'lkjstr',
    'lena',
    64,
    'Could the filter remember the last period? https://example.org/lkjstr/ideas',
  ],
  ['lkjstr', 'komorebi', 240, 'This channel is for questions and feedback. Bugs are welcome too.'],
  ['photo', 'mio', 150, '今日の一枚。逆光のすすき。'],
  ['photo', 'aoi', 210, '朝の川。霧が出ていました。'],
  ['photo', 'marco', 330, 'Pellicola scaduta, colori strani. Mi piace.'],
  ['photo', 'ichiro', 620, '稜線の雲。'],
  ['relay-ops', 'hiroshi', 44, 'Disk filled at 03:00 again. Retention is now 90 days.'],
  ['relay-ops', 'sam', 130, 'Anyone rate-limiting by pubkey age?'],
  ['books', 'sakura', 400, '今月は随筆にしませんか。短いのを一冊。'],
  ['dev', 'kenji', 75, 'Outbox model notes, second draft: https://example.org/outbox'],
  ['dev', 'priya', 180, 'Reading the NIP-44 test vectors. They are thorough.'],
];

/** Sentences for the older, generated part of the busiest channel (enough rows to scroll). */
export const CHANNEL_FILLER: readonly (readonly [by: string, text: string])[] = [
  ['taro', 'ビルドが速くなった気がする。気のせいかもしれない。'],
  ['sakura', 'お茶をいれました。'],
  ['kenji', 'このリレー、今夜は少し遅いですね。'],
  ['yuki', 'ねむい。'],
  ['akane', '訳していて、良い言い回しを見つけた日はうれしい。'],
  ['aoi', '散歩に行ってきます。'],
  ['ichiro', '次の週末は晴れそうです。'],
  ['komorebi', 'ゆっくり読んでいます。'],
];

/** What arrives in the first channel while the mock is live. */
export const CHANNEL_LIVE: readonly (readonly [by: string, text: string])[] = [
  ['taro', 'いま来ました。ログを読みます。'],
  ['sakura', 'お昼は何にしましょう。'],
  ['kenji', '新しいリレー実装を試しています。'],
  ['yuki', 'おはよう。'],
];
