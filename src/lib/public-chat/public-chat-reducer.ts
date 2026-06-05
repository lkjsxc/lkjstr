import { kinds, type NostrEvent } from '$lib/protocol';
import {
  channelReplyEventId,
  channelRootEventId,
  emptyPublicChatMetadata,
  parsePublicChatMetadata,
} from './public-chat-metadata';
import { applyHide, applyMute } from './public-chat-moderation';
import type {
  PublicChatChannel,
  PublicChatMessage,
  PublicChatState,
} from './public-chat-types';

export function emptyPublicChatState(): PublicChatState {
  return {
    channels: [],
    messages: [],
    channelCoverage: { relays: [], incomplete: true, diagnostics: [] },
    messageCoverage: { relays: [], incomplete: true, diagnostics: [] },
    hiddenMessageIds: [],
    mutedPubkeys: [],
  };
}

export function reducePublicChatEvents(
  state: PublicChatState,
  events: readonly NostrEvent[],
  relayUrls: readonly string[] = [],
): PublicChatState {
  let next = state;
  for (const event of events) {
    if (event.kind === kinds.channelCreate)
      next = mergeChannelCreate(next, event);
    if (event.kind === kinds.channelMetadata)
      next = mergeChannelMetadata(next, event);
    if (event.kind === kinds.channelMessage)
      next = mergeChannelMessage(next, event, relayUrls);
    if (event.kind === kinds.channelHideMessage) next = applyHide(next, event);
    if (event.kind === kinds.channelMuteUser) next = applyMute(next, event);
  }
  return sortState(next);
}

export function selectPublicChatChannel(
  state: PublicChatState,
  channelId: string | undefined,
): PublicChatState {
  return { ...state, selectedChannelId: channelId, messages: [] };
}

function mergeChannelCreate(
  state: PublicChatState,
  event: NostrEvent,
): PublicChatState {
  if (state.channels.some((channel) => channel.id === event.id)) return state;
  const metadata = safeMetadata(event.content);
  return {
    ...state,
    channels: [
      ...state.channels,
      {
        id: event.id,
        creatorPubkey: event.pubkey,
        createdAt: event.created_at,
        metadata,
        relayHints: metadata.relays,
      },
    ],
  };
}

function mergeChannelMetadata(
  state: PublicChatState,
  event: NostrEvent,
): PublicChatState {
  const channelId = channelRootEventId(event);
  if (!channelId) return state;
  return {
    ...state,
    channels: state.channels.map((channel) => {
      if (channel.id !== channelId || !metadataIsNewer(channel, event))
        return channel;
      const metadata = safeMetadata(event.content);
      return {
        ...channel,
        metadata,
        metadataEventId: event.id,
        metadataUpdatedAt: event.created_at,
        relayHints: metadata.relays,
      };
    }),
  };
}

function mergeChannelMessage(
  state: PublicChatState,
  event: NostrEvent,
  relayUrls: readonly string[],
): PublicChatState {
  const channelId = channelRootEventId(event);
  if (!channelId) return state;
  const message: PublicChatMessage = {
    eventId: event.id,
    channelId,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    content: event.content,
    replyTo: channelReplyEventId(event),
    relayUrls,
    hidden: state.hiddenMessageIds.includes(event.id),
    mutedAuthor: state.mutedPubkeys.includes(event.pubkey),
  };
  const messages = upsertMessage(state.messages, message);
  return {
    ...state,
    messages,
    channels: state.channels.map((channel) =>
      channel.id === channelId &&
      (!channel.lastMessageAt || event.created_at > channel.lastMessageAt)
        ? { ...channel, lastMessageAt: event.created_at }
        : channel,
    ),
  };
}

function sortState(state: PublicChatState): PublicChatState {
  return {
    ...state,
    channels: [...state.channels].sort(compareChannels),
    messages: [...state.messages].sort(compareMessages),
  };
}

function compareChannels(a: PublicChatChannel, b: PublicChatChannel): number {
  const activity = channelActivity(b) - channelActivity(a);
  return activity || a.id.localeCompare(b.id);
}

function channelActivity(channel: PublicChatChannel): number {
  return (
    channel.lastMessageAt ?? channel.metadataUpdatedAt ?? channel.createdAt
  );
}

function compareMessages(a: PublicChatMessage, b: PublicChatMessage): number {
  return a.createdAt - b.createdAt || a.eventId.localeCompare(b.eventId);
}

function metadataIsNewer(
  channel: PublicChatChannel,
  event: NostrEvent,
): boolean {
  const current = channel.metadataUpdatedAt ?? -1;
  return (
    event.created_at > current ||
    (event.created_at === current && event.id > (channel.metadataEventId ?? ''))
  );
}

function safeMetadata(content: string) {
  try {
    return parsePublicChatMetadata(content);
  } catch {
    return emptyPublicChatMetadata();
  }
}

function upsertMessage(
  messages: readonly PublicChatMessage[],
  message: PublicChatMessage,
): readonly PublicChatMessage[] {
  return messages.some((item) => item.eventId === message.eventId)
    ? messages.map((item) =>
        item.eventId === message.eventId ? message : item,
      )
    : [...messages, message];
}
