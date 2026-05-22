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
});

function reaction(content: string): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: '2'.repeat(64),
    created_at: 1,
    kind: 7,
    tags: [['emoji', 'party', 'https://x/party.png']],
    content,
    sig: '3'.repeat(128),
  };
}
