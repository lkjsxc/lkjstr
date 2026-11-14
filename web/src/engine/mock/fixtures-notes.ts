// The notes of the mock world, newest first. `ago` is minutes before the moment the mock starts. In `text`,
// `@handle` is a mention, `#tag` a hashtag, `:code:` a custom emoji and an address a link.
export type MediaSpec = readonly [w: number, h: number, hue: number, alt?: string];
export type NoteSpec = {
  readonly by: string;
  readonly ago: number;
  readonly text: string;
  /** A name other notes use to answer (`re`) or quote (`quote`) this one. */
  readonly tag?: string;
  readonly re?: string;
  readonly quote?: string;
  readonly media?: readonly MediaSpec[];
  /** A video or a sound after the pictures (`fixtures-media.ts`), with its description. */
  readonly clip?: readonly [type: 'video' | 'audio', alt?: string];
  readonly cw?: string;
  /** Handles of the people who reposted it (latest first). */
  readonly reposts?: readonly string[];
  /** Reactions: emoji (or `:code:`) and how many. A third `true` marks the reader's own. */
  readonly reactions?: readonly (readonly [string, number, boolean?])[];
  readonly zaps?: number;
  readonly hidden?: string;
  readonly client?: string;
};

const LONG_JA = `長い文章を書くときに考えていること。

まず、読む人の時間はこちらのものではない、という当たり前のことを思い出します。だから最初の一段落で、何の話なのか、読むとどうなるのかを書きます。そこで興味がなければ閉じてもらえばいい。

次に、段落は短くします。画面で読む文章は、紙よりも息継ぎが多いほうが楽です。一つの段落に一つのこと。接続詞は少なめに。

三つ目は、書いたあと一晩おくこと。翌朝に読むと、要らない文が必ず見つかります。削ると、残った文がよく聞こえるようになる。

四つ目は、声に出して読むこと。つっかえるところは、たいてい文が長すぎるか、言いたいことが二つ入っています。

最後に、誰か一人の顔を思い浮かべて書くこと。「みんな」に向けた文章は、結局だれにも届かない気がします。

以上、自分への覚え書きでした。明日の自分が読んで、また直すと思います。`;

const LONG_EN = `A few notes on reading relays' NIP-11 documents, after doing it by hand for forty relays.

1. Most relays tell the truth about limits, but not about retention. "We keep everything" usually means "we have not run out of disk yet".

2. max_subscriptions is the number that hurts clients first. Twenty sounds like a lot until one screen shows a feed, a thread, three profiles and their follow lists.

3. Nobody fills in the fees object the same way twice.

4. The software field is the most useful one for debugging: behaviour differs more between implementations than between operators.

5. A relay that requires auth to read is fine. A relay that requires auth and does not say so is a support ticket.

I wrote the results down in a table; link below when it is cleaned up.`;

export const NOTES: readonly NoteSpec[] = [
  {
    by: 'aoi',
    ago: 2,
    text: '朝の川沿い。霧が出ていて、対岸がほとんど見えませんでした。\n#写真 #朝散歩',
    media: [[1600, 1067, 205, '霧の川と対岸の木立']],
    tag: 'river',
    reactions: [
      ['❤️', 14, true],
      [':sakura:', 3],
      ['👏', 2],
    ],
    reposts: ['sakura', 'mio', 'kenji', 'akane', 'ichiro'],
    zaps: 2100,
  },
  {
    by: 'sam',
    ago: 6,
    text: 'Shipped a tiny thing: a relay list linter. It reads your kind 10002 and tells you which relays have been dead for a month.\nhttps://tools.rivera.example/relay-lint\n#nostr #tools',
    tag: 'lint',
    reactions: [
      ['🔥', 9],
      ['❤️', 21],
    ],
    reposts: ['ada'],
    zaps: 500,
  },
  {
    by: 'kenji',
    ago: 9,
    text: 'リレーの再起動が終わりました。5分ほど繋がりにくかったと思います、すみません :otsu:',
    tag: 'restart',
    reactions: [
      [':otsu:', 12],
      ['🙏', 4],
    ],
  },
  { by: 'taro', ago: 11, re: 'restart', text: '@kenji おつかれさまです。再接続も問題なしでした。' },
  {
    by: 'lena',
    ago: 15,
    text: 'Kerning the word "Tokyo" for an hour. The y and the o will never be friends.',
    reactions: [
      ['😂', 8],
      ['❤️', 5],
    ],
  },
  {
    by: 'sakura',
    ago: 19,
    text: '今月の主菓子は「初霜」。きんとんに氷餅をのせて、朝の庭の感じを出しています :sakura:',
    media: [
      [1200, 1200, 340, '白いきんとんの和菓子'],
      [1200, 1200, 20, '菓子皿と抹茶'],
    ],
    reactions: [
      ['❤️', 31],
      ['😋', 6],
    ],
    reposts: ['aoi'],
  },
  {
    by: 'ada',
    ago: 24,
    text: LONG_EN,
    tag: 'nip11',
    reactions: [
      ['🤝', 7],
      ['❤️', 18],
    ],
    reposts: ['sam', 'priya'],
    zaps: 4200,
  },
  {
    by: 'mio',
    ago: 31,
    text: 'らくがき。線だけのほうが好きかもしれない。',
    media: [[900, 1200, 320, '線画の少女']],
    reactions: [
      ['❤️', 40, true],
      ['🎨', 5],
    ],
  },
  {
    by: 'priya',
    ago: 33,
    re: 'nip11',
    text: '@ada Number 5 is painfully true. I spent a weekend on exactly that ticket.',
    tag: 'ticket',
  },
  {
    by: 'ada',
    ago: 30,
    re: 'ticket',
    text: '@priya My sympathies. Did the operator at least add it to the document afterwards?',
  },
  {
    by: 'priya',
    ago: 28,
    re: 'ticket',
    text: '@ada They did, after the third report. Small wins :ok:',
  },
  {
    by: 'ichiro',
    ago: 38,
    text: '八ヶ岳、初冠雪だそうです。今週末は軽アイゼンを持っていきます。\n#登山',
    reactions: [['⛰️', 6]],
  },
  {
    by: 'devbot',
    ago: 44,
    text: 'strfry 1.2.0 released\nhttps://github.com/example/strfry/releases/tag/1.2.0\n\nNegentropy sync is on by default; config key renamed, see notes.',
    client: 'release-bot',
    reactions: [['🚀', 15]],
  },
  {
    by: 'akane',
    ago: 52,
    text: '"local-first" をどう訳すか、まだ決めかねています。「手元優先」は意味は合っているけれど、少し硬い。',
    tag: 'localfirst',
    reactions: [
      ['🤔', 9],
      ['❤️', 4],
    ],
  },
  {
    by: 'taro',
    ago: 49,
    re: 'localfirst',
    text: '@akane 「まず手元」はどうでしょう。くだけすぎですかね。',
  },
  {
    by: 'akane',
    ago: 47,
    re: 'localfirst',
    text: '@taro いいですね。説明文には使えそうです。見出しには短いほうがいいので、もう少し考えます。',
  },
  { by: 'yuki', ago: 58, text: 'ねむい。', reactions: [[':kusa:', 3]] },
  {
    by: 'marco',
    ago: 66,
    text: "Pane di oggi. 78% idratazione, 20 ore in frigo. Today's loaf, in other words.",
    media: [
      [1600, 900, 40, 'A round loaf on a wooden board'],
      [900, 1200, 30, 'The crumb, cut in half'],
      [1600, 1200, 50, 'Flour on the table'],
    ],
    reactions: [
      ['🍞', 12],
      ['❤️', 9],
    ],
  },
  {
    by: 'sam',
    ago: 71,
    quote: 'river',
    text: 'This light. I keep thinking I should get up earlier.',
  },
  {
    by: 'mio',
    ago: 74,
    text: '朝の稜線。雲が流れていくのを六秒だけ。',
    media: [[1600, 900, 215, '朝の稜線の写真']],
    clip: ['video', '稜線の上を雲が流れていく動画'],
    reactions: [['❤️', 9]],
    zaps: 1200,
  },
  {
    by: 'sam',
    ago: 77,
    text: 'Five notes I keep humming while the tests run.',
    clip: ['audio', 'A short phrase of five notes'],
    reactions: [['🎵', 3]],
  },
  {
    by: 'kenji',
    ago: 80,
    text: 'うちの猫、キーボードの上で寝るのをやめてくれない :neko:',
    media: [[1600, 900, 28, 'キーボードの上で丸くなる猫']],
    reactions: [
      [':neko:', 22, true],
      ['❤️', 17],
    ],
    reposts: ['yuki', 'mio'],
  },
  {
    by: 'lena',
    ago: 95,
    text: 'A question for people who read Japanese on screens all day: do you prefer a slightly heavier weight for body text in dark mode, or the same as light?',
    tag: 'weight',
    reactions: [['❤️', 6]],
  },
  {
    by: 'akane',
    ago: 90,
    re: 'weight',
    text: '@lena Same weight, but a little more line height. Heavier kana get muddy fast.',
  },
  { by: 'aoi', ago: 88, re: 'weight', text: '@lena 同じ太さで、行間を少し広く、に一票です。' },
  {
    by: 'taro',
    ago: 104,
    text: '自宅サーバーのファンを静音のものに替えた。夜が静かになって、逆に冷蔵庫の音が気になりはじめた。',
    reactions: [
      [':kusa:', 14],
      ['😂', 5],
    ],
  },
  {
    by: 'hiroshi',
    ago: 118,
    text: 'Relay stats for the week: 41M events stored, 2.3k daily connections, p50 REQ latency 38 ms. Disk is the only thing growing faster than I would like.',
    reactions: [['📈', 4]],
  },
  {
    by: 'priya',
    ago: 131,
    text: 'Reading NIP-44 again. The padding scheme is simple enough to explain on a napkin, which is exactly what you want from one.',
    reactions: [['❤️', 8]],
    cw: '',
  },
  { by: 'sakura', ago: 140, text: '茶室の炉を開けました。今年も冬が来ます。' },
  {
    by: 'mio',
    ago: 152,
    text: '依頼の絵、ラフが通りました。ここからが長い。',
    reactions: [
      ['❤️', 11],
      ['💪', 6],
    ],
  },
  {
    by: 'ada',
    ago: 166,
    text: 'The dahlias survived the first frost. The tomatoes did not. Fair trade.',
    media: [[2400, 800, 275, 'A row of dahlias against a fence']],
    reactions: [['🌸', 10]],
  },
  {
    by: 'yuki',
    ago: 171,
    cw: 'ネタバレ: 今期のアニメ最終回',
    text: 'まさかあの人が最初から味方だったとは。一話から見直します。',
    media: [[1600, 900, 190, '最終回のワンシーン']],
  },
  { by: 'ichiro', ago: 185, text: '下山後の温泉までが登山です。', reactions: [['♨️', 19, true]] },
  {
    by: 'devbot',
    ago: 200,
    text: 'nostr-tools 2.9.4 released\nhttps://github.com/example/nostr-tools/releases/tag/v2.9.4',
    client: 'release-bot',
  },
  {
    by: 'marco',
    ago: 214,
    text: 'Qualcuno sa se esiste un relay italiano con ricerca NIP-50? Asking for a friend.',
    hidden: 'language',
  },
  {
    by: 'sam',
    ago: 226,
    text: 'Hot take: the best feature of a client is the one that lets you stop reading.',
    reactions: [
      ['💯', 16],
      ['❤️', 12],
    ],
    reposts: ['lena', 'ada', 'akane'],
  },
  {
    by: 'aoi',
    ago: 240,
    text: LONG_JA,
    reactions: [
      ['❤️', 26],
      ['📝', 7],
    ],
    reposts: ['akane'],
  },
  {
    by: 'kenji',
    ago: 262,
    text: 'スパム対策のルールを少し厳しくしました。普通に使っているぶんには影響ないはずです。もし書き込めなくなったら教えてください。\nhttps://relay.example.jp/rules',
  },
  {
    by: 'lena',
    ago: 280,
    text: 'New specimen sheet is printed.',
    media: [
      [1200, 1600, 12, 'A printed type specimen, black on cream'],
      [1200, 1600, 0, 'Detail of the italic'],
    ],
  },
  {
    by: 'taro',
    ago: 300,
    text: 'Rust の async で詰まったときは、だいたい Send が足りないか、ライフタイムを欲張っているかのどちらか。\n#rustlang',
    reactions: [['🦀', 9]],
  },
  {
    by: 'akane',
    ago: 330,
    text: '訳していて一番むずかしいのは、原文が曖昧なとき。曖昧なまま訳すのか、解釈して訳すのか。',
  },
  {
    by: 'sakura',
    ago: 365,
    text: '柚子をたくさんいただいたので、柚子餅にします。',
    media: [[1600, 1067, 55, 'かごいっぱいの柚子']],
  },
  {
    by: 'hiroshi',
    ago: 400,
    text: 'Scheduled maintenance tomorrow 03:00 UTC, about ten minutes. Clients should reconnect on their own.',
  },
  {
    by: 'priya',
    ago: 440,
    text: 'Today I learned that "bech32" is pronounced however you like, and everyone will correct you anyway.',
    reactions: [['😂', 20]],
  },
  {
    by: 'mio',
    ago: 470,
    text: '空の色の練習。',
    media: [
      [1600, 900, 320, '夕焼けの習作'],
      [1600, 900, 280, '朝焼けの習作'],
      [1600, 900, 220, '曇り空の習作'],
      [1600, 900, 200, '夜明け前の習作'],
    ],
  },
  {
    by: 'ichiro',
    ago: 520,
    text: '今日の一枚。稜線から。',
    media: [[2400, 800, 60, '稜線からの眺め、雲海']],
  },
  {
    by: 'ada',
    ago: 580,
    text: 'Found a box of 5¼-inch floppies in the attic. Labelled, in my handwriting, "IMPORTANT". No further detail. Thanks, past me.',
    reactions: [
      ['💾', 13],
      ['😂', 9],
    ],
  },
  { by: 'yuki', ago: 640, text: 'おはよう。さむい。' },
  {
    by: 'sam',
    ago: 700,
    text: 'Reminder that your relay list is public infrastructure for everyone trying to find your notes. Keep it short and alive.\n#nostr',
  },
  { by: 'aoi', ago: 760, text: '夕方の商店街。', media: [[1067, 1600, 25, '提灯のともる商店街']] },
];

/** Sentences for the older, generated part of the timeline (enough rows to scroll for a long time). */
export const FILLER: readonly (readonly [by: string, text: string])[] = [
  ['aoi', '今日は曇り。こういう日は色がやわらかくて好きです。'],
  ['kenji', 'リレーのログを眺めていると、世界中が同時に起きているのがわかる。'],
  ['taro', 'コンパイルが通った。それだけで今日はいい日。'],
  ['lena', 'Drew the same curve forty times. The forty-first was right.'],
  ['sam', 'Deleted more code than I wrote today. Good day.'],
  ['sakura', '干し柿が良い色になってきました。'],
  ['ada', 'Tea, rain, and a protocol document. A complete afternoon.'],
  ['ichiro', '地図を広げて、次の山を考えている時間が一番楽しいかもしれない。'],
  ['akane', '辞書を引くのは、知らない言葉より、知っているつもりの言葉のほうが多い。'],
  ['priya', 'Proofs are just very patient arguments.'],
  ['mio', '線が決まらない日は、手を洗って散歩に行く。'],
  ['yuki', 'おなかすいた。'],
  ['marco', 'The darkroom smells like vinegar and patience.'],
  ['hiroshi', 'Replaced a disk without downtime. Nobody noticed. Perfect.'],
  ['taro', 'ドキュメントを書いていたら、設計の穴が見つかった。書いてよかった。'],
  ['aoi', '同じ道でも、季節が変わると別の場所みたいです。'],
  ['lena', 'Good italics are a matter of rhythm, not slant.'],
  ['kenji', '猫が窓の外の鳥を見ている。平和。'],
  ['sam', 'Every cache is a small lie we agree to believe for a while.'],
  ['sakura', '今朝は霜柱が立っていました。'],
  ['ada', 'Planted garlic. See you in June.'],
  ['akane', '「適当」という言葉は、本当に適当に訳せない。'],
];
