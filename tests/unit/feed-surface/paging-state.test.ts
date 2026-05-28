import { describe, expect, it } from 'vitest';
import { feedPagingPhase } from '../../../src/lib/feed-surface/paging-state';

describe('feed paging phase', () => {
  it('reports loading older while more history may exist', () => {
    expect(
      feedPagingPhase({
        loadingOlder: true,
        hasOlder: true,
        rowCount: 3,
      }),
    ).toBe('loadingOlder');
  });

  it('reports end when history is exhausted', () => {
    expect(
      feedPagingPhase({
        loadingOlder: false,
        hasOlder: false,
        historyExhaustion: 'proven',
        rowCount: 2,
      }),
    ).toBe('end');
  });

  it('does not report terminal history without proof', () => {
    expect(
      feedPagingPhase({
        loadingOlder: false,
        hasOlder: false,
        historyExhaustion: 'unknown',
        rowCount: 2,
      }),
    ).toBe('idle');
  });
});
