import { describe, expect, it } from 'vitest';
import { compactOldEvents } from '../../../src/lib/cache/compaction';

describe('cache compaction', () => {
  it('reports disabled compaction without deleting', async () => {
    await expect(compactOldEvents({ enabled: false })).resolves.toMatchObject({
      prunedEvents: 0,
      skipped: true,
      reason: 'compaction disabled',
    });
  });
});
