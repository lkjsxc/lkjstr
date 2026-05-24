import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import {
  accountHomeFollowEntries,
  accountHomeAuthors,
  authorFilters,
} from '../../../src/lib/timeline/follow-list';

describe('follow list helpers', () => {
  it('dedupes p tags and includes the active account', () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(generateSecretKey());
    const event = finalizeEvent(
      {
        created_at: 1,
        kind: 3,
        tags: [
          ['p', followed],
          ['p', followed],
          ['p', 'bad'],
          ['e', followed],
        ],
        content: '',
      },
      activeKey,
    );
    expect(accountHomeAuthors(active, event)).toEqual([active, followed]);
  });

  it('preserves NIP-02 relay hints and petnames', () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(generateSecretKey());
    const event = finalizeEvent(
      {
        created_at: 1,
        kind: 3,
        tags: [['p', followed, 'wss://relay.example', 'alice']],
        content: '',
      },
      activeKey,
    );
    expect(accountHomeFollowEntries(active, event)).toEqual([
      { pubkey: active },
      {
        pubkey: followed,
        relayUrl: 'wss://relay.example',
        petname: 'alice',
      },
    ]);
  });

  it('chunks large author filters', () => {
    const authors = Array.from({ length: 201 }, (_, index) => pubkey(index));
    const filters = authorFilters(authors, 50);
    expect(filters).toHaveLength(2);
    expect(filters[0]?.authors).toHaveLength(200);
    expect(filters[1]?.authors).toHaveLength(1);
  });

  it('keeps chunked author request limits positive', () => {
    const authors = Array.from({ length: 7000 }, (_, index) => pubkey(index));
    const filters = authorFilters(authors, 30);
    const total = filters.reduce((sum, filter) => sum + (filter.limit ?? 0), 0);
    expect(filters.length).toBeGreaterThan(30);
    expect(total).toBeGreaterThan(30);
    expect(filters.every((filter) => (filter.limit ?? 0) > 0)).toBe(true);
  });
});

function pubkey(index: number): string {
  return index.toString(16).padStart(64, '0');
}
