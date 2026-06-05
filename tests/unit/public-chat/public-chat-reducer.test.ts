import { describe, expect, it } from 'vitest';
import { kinds, type NostrEvent } from '../../../src/lib/protocol';
import {
  emptyPublicChatState,
  reducePublicChatEvents,
  selectPublicChatChannel,
} from '../../../src/lib/public-chat/public-chat-reducer';

describe('public chat reducer', () => {
  it('merges channels and metadata by real events', () => {
    let state = emptyPublicChatState();
    state = reducePublicChatEvents(state, [
      event('b', 'creator', 10, kinds.channelCreate, '{"name":"Beta"}'),
      event('a', 'creator', 20, kinds.channelCreate, '{"name":"Alpha"}'),
    ]);
    expect(state.channels.map((channel) => channel.id)).toEqual(['a', 'b']);
    state = reducePublicChatEvents(state, [
      event(
        'm',
        'creator',
        30,
        kinds.channelMetadata,
        '{"name":"Beta updated"}',
        [['e', 'b', '', 'root']],
      ),
    ]);
    expect(state.channels.map((channel) => channel.id)).toEqual(['b', 'a']);
    expect(state.channels[0]?.metadata.name).toBe('Beta updated');
  });

  it('renders messages in chat order and keeps reply context', () => {
    let state = reducePublicChatEvents(emptyPublicChatState(), [
      event('c', 'creator', 1, kinds.channelCreate, '{}'),
    ]);
    state = selectPublicChatChannel(state, 'c');
    state = reducePublicChatEvents(state, [
      message('z', 'alice', 30, 'c', 'late'),
      message('a', 'bob', 20, 'c', 'early', 'z'),
    ]);
    expect(state.messages.map((item) => item.content)).toEqual([
      'early',
      'late',
    ]);
    expect(state.messages[0]?.replyTo).toBe('z');
  });

  it('applies signed hide and mute actions without removing rows', () => {
    let state = reducePublicChatEvents(emptyPublicChatState(), [
      message('m', 'muted', 2, 'c', 'secret'),
    ]);
    state = reducePublicChatEvents(state, [
      event('h', 'me', 3, kinds.channelHideMessage, '', [['e', 'm']]),
      event('u', 'me', 4, kinds.channelMuteUser, '', [['p', 'muted']]),
    ]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      hidden: true,
      mutedAuthor: true,
    });
  });
});

function message(
  id: string,
  pubkey: string,
  createdAt: number,
  channelId: string,
  content: string,
  replyId?: string,
): NostrEvent {
  const tags = [['e', channelId, '', 'root']];
  if (replyId) tags.push(['e', replyId, '', 'reply']);
  return event(id, pubkey, createdAt, kinds.channelMessage, content, tags);
}

function event(
  id: string,
  pubkey: string,
  createdAt: number,
  kind: number,
  content: string,
  tags: readonly string[][] = [],
): NostrEvent {
  return { id, pubkey, created_at: createdAt, kind, tags, content, sig: 'sig' };
}
