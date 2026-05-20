import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { describe, expect, it } from 'vitest';
import {
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

  it('chunks large author filters', () => {
    const authors = Array.from({ length: 201 }, () =>
      getPublicKey(generateSecretKey()),
    );
    const filters = authorFilters(authors, 50);
    expect(filters).toHaveLength(2);
    expect(filters[0]?.authors).toHaveLength(200);
    expect(filters[1]?.authors).toHaveLength(1);
  });

  it('keeps chunked author request limits within the page budget', () => {
    const authors = Array.from({ length: 7000 }, () =>
      getPublicKey(generateSecretKey()),
    );
    const filters = authorFilters(authors, 30);
    const total = filters.reduce((sum, filter) => sum + (filter.limit ?? 0), 0);
    expect(filters.length).toBeGreaterThan(30);
    expect(total).toBe(30);
  });
});
