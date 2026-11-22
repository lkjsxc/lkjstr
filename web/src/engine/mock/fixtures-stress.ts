// Relay text far past any sane length, for the stress scenes (`mock.stress`; the default world stays as it is): a
// name with no space to break at, a right-to-left name, runs of emoji and of custom emoji, addresses wider than a
// phone, a word of hundreds of letters. People change in place, so every row that draws them does (notes, reposts,
// notifications, profiles, accounts, tab titles); the notes added here carry the rest: reposts by several of them, a
// reply line, a client name, a link card, a quote, mentions and reaction chips. Channel and emoji set names too.
import type { Author } from '../protocol.ts';
import { byHandle, EMOJI, EMOJI_SETS, emojiOf } from './people.ts';
import { initialReactions } from './reactions.ts';
import { idOf, type World } from './world.ts';

/** A custom emoji whose code is longer than any chip should be. */
export const LONG_CODE =
  'an_absurdly_long_custom_emoji_shortcode_that_nobody_should_ever_have_to_type_twice';
/** One word with nowhere to break. */
export const LONG_WORD = 'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(5);
/** The title a link card gets for a path under `/stress/` (fixtures-previews.ts). */
export const LONG_TITLE = `${'An extraordinarily long page title that keeps going '.repeat(4)}${LONG_WORD}`;
const LONG_HOST =
  'a-very-long-host-name-for-a-link-card.subdomain.of-an-example-domain.example.com';

const NAMES: Record<string, Partial<Author>> = {
  sam: {
    name: 'Sam_Rivera_builds_small_tools_for_the_open_web_and_will_not_stop_typing_his_name_until_the_tile_gives_up',
    nip05:
      'sam.rivera.builds.small.tools.for.the.open.web@an-extraordinarily-long-subdomain.rivera.example',
  },
  lena: { name: 'لينا فيشر، مصممة حروف في برلين: الحروف والدراجات والمشي الطويل على ضفاف النهر' },
  kenji: { name: `佐藤健二 ${':neko:'.repeat(14)}` },
  taro: { name: `山田太郎 ${'🦀'.repeat(24)}👩‍💻👨‍👩‍👧‍👦🏳️‍🌈` },
  aoi: {
    name: '高橋葵（写真と散歩と朝の光と川沿いの道とフィルムとデジタルのどちらも大好きな人です）',
    nip05: 'takahashi.aoi.photo.walks.in.the.morning.light@example.jp',
  },
  sakura: {
    nip05:
      'sakura.no.wagashi.to.kisetsu.no.hanashi@a-very-long-subdomain.of-an-example-domain.example.jp',
  },
  komorebi: { nip05: 'komorebi.reads.and.sometimes.writes.on.a.very.quiet.timeline@example.jp' },
  'komorebi-dev': {
    name: '木漏れ日（開発）検証用のアカウントにとても長い名前を付けてしまったのでどこまで表示されるか試しています',
  },
};
const ABOUT: Record<string, string> = {
  aoi: `写真と散歩。https://example.jp/${'photo-walk-'.repeat(16)}end ${LONG_WORD}`,
  lena: 'מעצבת אותיות בברלין. אותיות, אופניים והליכות ארוכות לאורך הנהר בכל עונה של השנה.',
  sam: `${LONG_WORD} ${'🛠️'.repeat(40)}`,
};

/** Idempotent: the world is configured again on every settings change. */
export function addStress(w: World): void {
  if (w.byId.has(idOf(7300))) return;
  for (const [handle, author] of Object.entries(NAMES)) {
    const p = byHandle(handle);
    Object.assign(p.author, author, author.name ? { emoji: emojiOf(author.name) } : {});
  }
  for (const [handle, about] of Object.entries(ABOUT))
    (byHandle(handle) as { about: string }).about = about;
  EMOJI[LONG_CODE] = EMOJI.neko ?? '';
  const sets = EMOJI_SETS as unknown as [string, string, string[]][];
  if (sets[1])
    sets[1][0] =
      'ことばのセットにとても長い名前を付けてみたらどこまで表示されるのか試しているところです';
  const [first, second] = w.state.channels;
  if (first) first.name = `Nostr 日本語 ${'とても長いチャンネルの名前'.repeat(4)}`;
  if (second) second.name = `lkjstr_${'and_a_channel_name_without_spaces_'.repeat(3)}`;

  const at = (minutes: number): number => w.base - minutes * 60_000;
  const sam = byHandle('sam');
  const head = w.arrive(
    sam,
    `${LONG_WORD}\nhttps://${LONG_HOST}/stress/${'path-segment-'.repeat(10)}end`,
    at(0.5),
    {
      id: idOf(7300),
      client: `${'An Absurdly Long Client Name '.repeat(4)}${LONG_WORD}`,
      reposts: ['aoi', 'lena', 'kenji', 'sakura', 'taro'].map((h, k) => ({
        by: byHandle(h),
        at: at(0.4) - k * 1000,
      })),
      reactions: initialReactions([
        [`:${LONG_CODE}:`, 3],
        [`:${LONG_CODE}:`.toUpperCase(), 1],
        ['👨‍👩‍👧‍👦', 2],
        ['🏳️‍🌈', 1],
      ]),
    },
  );
  w.arrive(
    byHandle('lena'),
    `مرحبا nostr:${sam.author.npub} — זה טקסט מימין לשמאל עם מילה ארוכה ${LONG_WORD} בתוכו.`,
    at(1),
    { id: idOf(7301) },
  );
  w.arrive(byHandle('kenji'), `${'🐈'.repeat(90)}${':neko:'.repeat(24)}`, at(1.5), {
    id: idOf(7302),
    quote: head.id,
  });
  w.arrive(byHandle('taro'), `@sam ${LONG_WORD}`, at(2), { id: idOf(7303), re: head.id });
  w.notes.sort((a, b) => b.at - a.at);
}
