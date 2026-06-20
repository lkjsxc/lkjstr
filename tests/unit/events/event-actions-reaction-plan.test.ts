import { describe, expect, it } from 'vitest';
import type { RelaySet } from '../../../src/lib/relays/relay-store';
import {
  planCustomEmojiEventReaction,
  planEventActionEmojiSource,
  planUnicodeEventReaction,
} from '../../../src/lib/components/events/event-actions-reaction-plan';

describe('event action reaction plan', () => {
  it('plans unicode and custom emoji reaction payloads', () => {
    const custom = { shortcode: 'party', url: 'https://emoji.example/p.png' };

    expect(planUnicodeEventReaction('+')).toEqual({ content: '+' });
    expect(planCustomEmojiEventReaction(custom)).toEqual({
      content: ':party:',
      emoji: custom,
    });
  });

  it('plans emoji loading with account identity and selected read relays', () => {
    const plan = planEventActionEmojiSource('pubkey', [
      relaySet([
        relay('wss://relay-b.example', { read: true }),
        relay('wss://relay-c.example', { read: false }),
        relay('relay-a.example', { read: true }),
      ]),
    ]);

    expect(plan).toEqual({
      key: 'pubkey|wss://relay-a.example/\u0000wss://relay-b.example/',
      pubkey: 'pubkey',
      relays: ['wss://relay-a.example/', 'wss://relay-b.example/'],
    });
  });

  it('keeps anonymous emoji source plans explicit', () => {
    expect(planEventActionEmojiSource(null, []).key).toBe('|');
    expect(planEventActionEmojiSource(null, []).pubkey).toBeUndefined();
  });
});

function relaySet(relays: RelaySet['relays']): RelaySet {
  return {
    id: 'selected',
    name: 'Selected',
    purpose: 'user',
    seeded: false,
    relays,
    updatedAt: 1,
  };
}

function relay(
  url: string,
  options: Partial<RelaySet['relays'][number]> = {},
): RelaySet['relays'][number] {
  return {
    url,
    label: url,
    enabled: true,
    read: true,
    write: true,
    state: 'idle',
    health: { attempts: 0, successes: 0, failures: 0 },
    updatedAt: 1,
    ...options,
  };
}
