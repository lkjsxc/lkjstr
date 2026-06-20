import { customEmojiTokenText, type CustomEmoji } from '$lib/protocol';
import type { RelaySet } from '$lib/relays/relay-store';
import { timelineRelays } from '$lib/timeline/timeline-subscription';

export type EventActionReactionInput = {
  readonly content: string;
  readonly emoji?: CustomEmoji;
};

export type EventActionEmojiSourcePlan = {
  readonly key: string;
  readonly pubkey?: string;
  readonly relays: readonly string[];
};

export function planUnicodeEventReaction(
  content: string,
): EventActionReactionInput {
  return { content };
}

export function planCustomEmojiEventReaction(
  emoji: CustomEmoji,
): EventActionReactionInput {
  return {
    content: customEmojiTokenText(emoji.shortcode),
    emoji,
  };
}

export function planEventActionEmojiSource(
  activeAccountPubkey: string | null | undefined,
  relaySets: readonly RelaySet[],
): EventActionEmojiSourcePlan {
  const relays = timelineRelays(relaySets);
  return {
    key: `${activeAccountPubkey ?? ''}|${relays.join('\u0000')}`,
    pubkey: activeAccountPubkey ?? undefined,
    relays,
  };
}
