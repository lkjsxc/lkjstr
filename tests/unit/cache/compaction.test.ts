import { describe, expect, it } from 'vitest';
import { scoreEvent } from '../../../src/lib/cache/event-priority';
import { compactOldEvents } from '../../../src/lib/cache/compaction';

describe('cache compaction', () => {
  it('scores structural relationships above baseline time', () => {
    const score = scoreEvent({
      id: 'a',
      pubkey: 'p',
      created_at: 100,
      kind: 1,
      tags: [['e', 'parent', '', 'reply']],
      content: '',
      sig: 'sig',
    });
    expect(score).toBeGreaterThan(100);
  });

  it('no-ops when indexeddb is unavailable in tests', async () => {
    await expect(compactOldEvents()).resolves.toMatchObject({
      skipped: true,
      prunedEvents: 0,
    });
  });
});
