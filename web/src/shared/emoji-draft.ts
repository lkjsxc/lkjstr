// A draft keeps each chosen picture under an unambiguous shortcode.
import type { Emoji } from '../engine/protocol.ts';
import type { Picked } from './emoji-used.ts';

const MAX_CODE = 64;

/** Only pictures still named by the current draft can reserve a shortcode. */
export const usedDraftEmoji = (
  emoji: readonly Emoji[] | undefined,
  text: string,
): readonly Emoji[] => (emoji ?? []).filter((tag) => text.includes(`:${tag.code}:`));

export function insertDraftEmoji(
  existing: readonly Emoji[] | undefined,
  picked: Picked,
): { text: string; emoji: readonly Emoji[] } {
  const emoji = existing ?? [];
  if (!picked.url) return { text: picked.emoji, emoji };
  const base = picked.emoji.slice(1, -1);
  const alias = (index: number): string => {
    const suffix = `_${index}`;
    return base.slice(0, MAX_CODE - suffix.length) + suffix;
  };
  const byCode = new Map(emoji.map((tag) => [tag.code, tag]));
  const reusable = emoji.find((tag) => {
    if (tag.url !== picked.url || byCode.get(tag.code)?.url !== picked.url) return false;
    if (tag.code === base) return true;
    const suffix = tag.code.match(/_([1-9][0-9]*)$/)?.[1];
    const index = Number(suffix);
    return Number.isSafeInteger(index) && index >= 2 && tag.code === alias(index);
  });
  if (reusable) return { text: `:${reusable.code}:`, emoji };
  let code = base;
  let suffix = 2;
  while (byCode.has(code)) code = alias(suffix++);
  const tag: Emoji = {
    code,
    url: picked.url,
    ...(picked.address ? { address: picked.address } : {}),
  };
  return { text: `:${code}:`, emoji: [...emoji, tag] };
}
