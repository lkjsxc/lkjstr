import type { NostrEvent } from '$lib/protocol';
import { hideMessageTarget, muteUserTarget } from './public-chat-metadata';
import type { PublicChatState } from './public-chat-types';

export function applyHide(
  state: PublicChatState,
  event: NostrEvent,
): PublicChatState {
  const target = hideMessageTarget(event);
  if (!target) return state;
  const hiddenMessageIds = unique([...state.hiddenMessageIds, target]);
  return {
    ...state,
    hiddenMessageIds,
    messages: state.messages.map((message) =>
      hiddenMessageIds.includes(message.eventId)
        ? { ...message, hidden: true }
        : message,
    ),
  };
}

export function applyMute(
  state: PublicChatState,
  event: NostrEvent,
): PublicChatState {
  const target = muteUserTarget(event);
  if (!target) return state;
  const mutedPubkeys = unique([...state.mutedPubkeys, target]);
  return {
    ...state,
    mutedPubkeys,
    messages: state.messages.map((message) =>
      mutedPubkeys.includes(message.pubkey)
        ? { ...message, mutedAuthor: true }
        : message,
    ),
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
