// The Unicode emoji the picker offers: the ones people actually react with, each with words to find it by in
// English and Japanese. One entry is "emoji words…", entries are separated by "|". Anything not here can still be
// typed or pasted into the picker's field and used.
const DATA = [
  '❤️ heart love red ハート 愛 すき|👍 thumbs up good like いいね グッド|🙏 pray thanks please ありがとう お願い 感謝|😂 joy laugh tears 笑 泣き笑い わら|🤣 rofl laugh 爆笑 笑',
  '🔥 fire hot 火 炎 熱い|🎉 party tada congrats おめでとう 祝 クラッカー|👀 eyes look 目 見る|✨ sparkles shiny キラキラ|💯 hundred perfect 百点 満点|🫂 hug people ハグ|🤙 call shaka シャカ',
  '😀 grin smile 笑顔|😄 smile happy 笑顔 にこにこ|😊 blush smile 照れ にっこり|🙂 slight smile 微笑み|😉 wink ウインク|😍 heart eyes love 目がハート|🥰 loved hearts うれしい 愛|😘 kiss キス',
  '😎 cool sunglasses サングラス クール|🤔 thinking hmm 考える うーん|🤨 raised eyebrow doubt 疑い|😐 neutral 無表情|😑 expressionless 無|🙄 eye roll あきれ|😏 smirk にやり|😴 sleep zzz 寝る 眠い',
  '😅 sweat smile 汗 苦笑|😇 angel halo 天使|🥲 smile tear 泣き笑顔|😢 cry sad 泣く 悲しい|😭 sob cry 号泣 泣|😤 huff triumph ふんす|😠 angry 怒る|😡 rage angry 激怒|🤯 mind blown 爆発 驚き',
  '😱 scream shock 叫び 驚き|😳 flushed 赤面|🥺 pleading ぴえん お願い|😬 grimace 苦い|🤗 hug ハグ|🤭 oops giggle くすくす|🤫 shh quiet しー|😋 yum delicious おいしい うまい|🤤 drool よだれ',
  '🥳 party celebrate お祝い パーティ|🤩 star struck すごい 目が星|😵 dizzy めまい|🥴 woozy ふらふら|🤒 sick 熱 病気|😷 mask マスク|🤮 vomit 吐く|💀 skull dead 死 ドクロ|👻 ghost おばけ|🤖 robot ロボット',
  '👏 clap applause 拍手 ぱちぱち|🙌 raise hands banzai 万歳 ばんざい|👌 ok okay オーケー|✌️ peace victory ピース|🤝 handshake 握手|💪 muscle strong 筋肉 がんばる|🫡 salute 敬礼 了解|🙇 bow おじぎ すみません',
  '👋 wave hello bye 手を振る こんにちは|👎 thumbs down bad よくない|🤞 fingers crossed 祈る|🫶 heart hands ハート|☝️ point up 上|👉 point right 右|👈 point left 左|🤷 shrug さあ わからない|🙆 ok まる|🙅 no だめ ばつ',
  '🧡 orange heart オレンジ ハート|💛 yellow heart 黄 ハート|💚 green heart 緑 ハート|💙 blue heart 青 ハート|💜 purple heart 紫 ハート|🖤 black heart 黒 ハート|🤍 white heart 白 ハート|💔 broken heart 失恋|💕 hearts ハート',
  '⚡ zap lightning 雷 ザップ|⭐ star 星|🌟 glowing star 輝く星|💡 idea bulb ひらめき 電球|💥 boom 爆発|💤 zzz sleep 眠い|💢 anger 怒り|💦 sweat 汗|🎵 music note 音楽 音符|🔔 bell ベル 通知',
  '✅ check done 完了 チェック|❌ cross no ばつ|⭕ circle ok まる|❓ question 疑問 はてな|❗ exclamation びっくり|➕ plus 足す|🆗 ok オーケー|🆒 cool クール|🈁 koko ここ|🔗 link リンク|📌 pin ピン',
  '☀️ sun sunny 晴れ 太陽|🌙 moon 月 夜|☁️ cloud 曇り 雲|☔ rain umbrella 雨 傘|❄️ snow 雪|🌈 rainbow 虹|🌸 cherry blossom sakura 桜|🌻 sunflower ひまわり|🍁 maple autumn 紅葉 もみじ|🌊 wave 波 海',
  '🐱 cat 猫 ねこ|🐶 dog 犬 いぬ|🐦 bird 鳥|🐟 fish 魚|🐸 frog かえる|🐧 penguin ペンギン|🦊 fox きつね|🐻 bear くま|🐰 rabbit うさぎ|🦉 owl ふくろう|🐢 turtle かめ|🦀 crab かに',
  '🍵 tea green tea お茶 緑茶|☕ coffee コーヒー|🍺 beer ビール|🍶 sake 酒 日本酒|🍙 onigiri rice ball おにぎり|🍣 sushi 寿司 すし|🍜 ramen noodles ラーメン|🍛 curry カレー|🍡 dango だんご|🍰 cake ケーキ|🍎 apple りんご|🍊 orange mikan みかん',
  '🚀 rocket ロケット|🎯 target dart 的|🏆 trophy 優勝 トロフィー|🎁 gift present プレゼント|📷 camera カメラ 写真|📚 books 本|✏️ pencil write 鉛筆 書く|💻 laptop pc パソコン|📱 phone スマホ|🔑 key 鍵|🛠️ tools 工具|🧵 thread スレッド 糸',
  '🗾 japan 日本|🗻 fuji 富士山|⛩️ shrine torii 神社 鳥居|🎌 flags 祝日 旗|🚃 train 電車|🚲 bicycle 自転車|✈️ plane 飛行機|🏠 house 家|🌏 earth 地球|⏰ alarm clock 時計 目覚まし|👑 crown 王冠|💰 money お金',
].join('|');

export type Glyph = { readonly emoji: string; readonly words: string };
export const GLYPHS: readonly Glyph[] = DATA.split('|').map((entry) => {
  const at = entry.indexOf(' ');
  return { emoji: entry.slice(0, at), words: entry.slice(at + 1).toLowerCase() };
});

/** Emoji whose words contain everything typed (any order, any of the two languages). */
export function findGlyphs(typed: string): readonly Glyph[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? GLYPHS.filter((g) => words.every((w) => g.words.includes(w))) : GLYPHS;
}
/** Whether the text is itself one emoji (typed or pasted): it can be used although it is not in the table. */
export const isEmoji = (text: string): boolean =>
  /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*$/u.test(text);
