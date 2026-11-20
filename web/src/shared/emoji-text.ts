// Unicode emoji in running text, one grapheme each: a flag, a keycap, a toned emoji or a joined (ZWJ) sequence is one
// emoji, never its parts. Symbols that are text unless asked to be emoji (©, ™, arrows, ▶) stay text. Pure, tested.

/** Anything that could start an emoji; text without one is not segmented at all. */
const ANY = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
const PICTURE = /^\p{Extended_Pictographic}/u;
const SHOWN = /^\p{Emoji_Presentation}/u;
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /^[#*0-9]\uFE0F?\u20E3$/u;
/** Asked to be an emoji: the emoji selector, a joiner or a skin tone. */
const ASKED = /\uFE0F|\u200D|[\u{1F3FB}-\u{1F3FF}]/u;

/** Whether one grapheme is an emoji. Below U+2600 a pictograph is text by default and counts only when asked. */
export function isEmojiGrapheme(g: string): boolean {
  if (g.includes('\uFE0E')) return false; // asked to be drawn as text
  if (FLAG.test(g) || KEYCAP.test(g)) return true;
  if (!PICTURE.test(g)) return false;
  return SHOWN.test(g) || ASKED.test(g) || (g.codePointAt(0) ?? 0) >= 0x2600;
}

export type Run = string | { readonly emoji: string };
let graphemes: Intl.Segmenter | undefined;

/** The text as plain runs and emoji, in order; joined back they are the text exactly. */
export function emojiRuns(text: string): Run[] {
  if (!ANY.test(text)) return [text];
  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const out: Run[] = [];
  let plain = '';
  for (const { segment } of graphemes.segment(text)) {
    if (!isEmojiGrapheme(segment)) {
      plain += segment;
      continue;
    }
    if (plain) out.push(plain);
    plain = '';
    out.push({ emoji: segment });
  }
  if (plain) out.push(plain);
  return out;
}

/** What an emoji is looked up by: the presentation selectors do not make it another emoji. */
export const emojiKey = (g: string): string => g.replace(/\uFE0E|\uFE0F/g, '');
