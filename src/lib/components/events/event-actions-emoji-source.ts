import type { CustomEmoji } from '$lib/protocol';
import type { EventActionEmojiSourcePlan } from './event-actions-plan';

export type EventActionEmojiLoadCallbacks = {
  readonly isCurrent: (request: number) => boolean;
  readonly loadAccountEmojiSource: (input: {
    readonly pubkey?: string;
    readonly relays: readonly string[];
  }) => Promise<readonly CustomEmoji[]>;
  readonly nextRequest: () => number;
  readonly setCustomEmojis: (emoji: readonly CustomEmoji[]) => void;
};

export async function loadEventActionEmojiSource(
  source: EventActionEmojiSourcePlan,
  callbacks: EventActionEmojiLoadCallbacks,
): Promise<void> {
  const request = callbacks.nextRequest();
  const emoji = await callbacks.loadAccountEmojiSource({
    pubkey: source.pubkey,
    relays: source.relays,
  });
  if (callbacks.isCurrent(request)) callbacks.setCustomEmojis(emoji);
}
