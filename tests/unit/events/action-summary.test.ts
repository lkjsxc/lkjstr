import { describe, expect, it } from 'vitest';
import { actionSummary } from '../../../src/lib/events/action-summary';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('action summary', () => {
  it('keeps reaction kind structured for renderers', () => {
    expect(actionSummary(reaction('+'))?.reaction).toMatchObject({
      kind: 'like',
    });
    expect(actionSummary(reaction(':party:'))?.reaction).toMatchObject({
      kind: 'custom-emoji',
      emoji: { shortcode: 'party', url: 'https://x/party.png' },
    });
  });

  it('renders likes as heart reactions', () => {
    expect(actionSummary(reaction('+'))).toMatchObject({
      verb: 'reacted with',
      detail: '❤️',
    });
    expect(actionSummary(reaction(''))).toMatchObject({
      verb: 'reacted with',
      detail: '❤️',
    });
  });

  it('renders visible emoji and dislike reactions without liked wording', () => {
    expect(actionSummary(reaction('☆'))).toMatchObject({
      verb: 'reacted with',
      detail: '☆',
    });
    expect(actionSummary(reaction('-'))).toMatchObject({
      verb: 'disliked',
    });
    expect(actionSummary(reaction('+'))?.verb).not.toBe('liked');
  });

  it('renders generic repost detail without leading spacing', () => {
    expect(actionSummary(genericRepost([['k', '30023']]))).toMatchObject({
      verb: 'reposted',
      detail: 'kind 30023',
    });
    expect(actionSummary(genericRepost([]))).toMatchObject({
      verb: 'reposted',
      detail: 'an event',
    });
  });
});

function reaction(content: string): NostrEvent {
  return event({
    kind: 7,
    content,
    tags: [['emoji', 'party', 'https://x/party.png']],
  });
}

function genericRepost(tags: string[][]): NostrEvent {
  return event({ kind: 16, content: '', tags });
}

function event({
  kind,
  content,
  tags,
}: {
  kind: number;
  content: string;
  tags: string[][];
}): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: '2'.repeat(64),
    created_at: 1,
    kind,
    tags,
    content,
    sig: '3'.repeat(128),
  };
}
