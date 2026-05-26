import { describe, expect, it } from 'vitest';
import {
  feedSurfaceStatusProps,
  footerPhaseFromPaging,
} from '../../../src/lib/feed-surface/footer-phase';

describe('footerPhaseFromPaging', () => {
  it('maps loading older state', () => {
    expect(
      footerPhaseFromPaging({
        loadingOlder: true,
        hasOlder: true,
        rowCount: 3,
      }),
    ).toBe('loadingOlder');
    expect(
      feedSurfaceStatusProps(
        footerPhaseFromPaging({
          loadingOlder: true,
          hasOlder: true,
          rowCount: 3,
        }),
      ).loadingOlder,
    ).toBe(true);
  });

  it('maps end of history', () => {
    expect(
      footerPhaseFromPaging({
        loadingOlder: false,
        hasOlder: false,
        rowCount: 2,
      }),
    ).toBe('end');
  });
});
