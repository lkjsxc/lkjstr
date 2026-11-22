// Emoji identity and collision fixtures for the mock engine.
import { reactionLabel } from '../../shared/reactions.ts';
import type { Publish } from '../protocol.ts';
import { byHandle, EMOJI, EMOJI_SETS, emojiOfSet } from './people.ts';

export type React = {
  count: number;
  mine: boolean;
  emoji?: string;
  url?: string;
  address?: string;
  set?: string;
};
const reactionKey = (emoji: string, url?: string): string =>
  url ? JSON.stringify([emoji, url]) : emoji;

export function initialReactions(
  entries: readonly (readonly [string, number, boolean?])[],
): Map<string, React> {
  return new Map(
    entries.map(([emoji, count, mine]): [string, React] => {
      const url = emoji.startsWith(':') ? EMOJI[emoji.slice(1, -1)] : undefined;
      return [reactionKey(emoji, url), { emoji, url, count, mine: mine === true }];
    }),
  );
}

export function collisionChips(reactions: Map<string, React> | undefined): void {
  for (const [d, set, count, mine] of [
    ['kotoba', 'ことば', 8, true],
    ['kurashi', 'くらし', 3, false],
  ] as const) {
    const url = emojiOfSet('pien', d);
    reactions?.set(reactionKey(':pien:', url), {
      emoji: ':pien:',
      url,
      count,
      mine,
      set,
      address: `30030:${byHandle('komorebi').author.pubkey}:${d}`,
    });
  }
}

export function addReaction(
  reactions: Map<string, React>,
  what: Extract<Publish, { k: 'reaction' }>,
): void {
  const key = reactionKey(what.emoji, what.url);
  const old = reactions.get(key) ?? { count: 0, mine: false };
  const set = what.address
    ? EMOJI_SETS.find(
        ([, d]) => d && what.address === `30030:${byHandle('komorebi').author.pubkey}:${d}`,
      )?.[0]
    : undefined;
  if (!old.mine)
    reactions.set(key, {
      ...old,
      emoji: what.emoji,
      url: what.url,
      address: what.address,
      set,
      count: old.count + 1,
      mine: true,
    });
}

export function removeReaction(
  reactions: Map<string, React>,
  what: Extract<Publish, { k: 'delete' }>,
): void {
  for (const [key, row] of reactions) {
    if (
      !row.mine ||
      (what.emoji !== undefined && reactionLabel(what.emoji) !== reactionLabel(row.emoji ?? key)) ||
      (what.url !== undefined && what.url !== (row.url ?? ''))
    )
      continue;
    if (row.count <= 1) reactions.delete(key);
    else reactions.set(key, { ...row, count: row.count - 1, mine: false });
  }
}
