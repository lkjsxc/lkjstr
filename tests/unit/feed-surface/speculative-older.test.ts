import { describe, expect, it } from 'vitest';
import { createOlderRequestCoordinator } from '../../../src/lib/feed-surface/speculative-older';

describe('speculative older coordinator', () => {
  it('loads twice when more history remains after the first page', async () => {
    let loads = 0;
    let hasOlder = true;
    const coordinator = createOlderRequestCoordinator(
      async () => {
        loads += 1;
        if (loads >= 2) hasOlder = false;
      },
      () => hasOlder,
    );
    await coordinator.requestFromNearEnd();
    expect(loads).toBe(2);
  });

  it('dedupes concurrent near-end requests', async () => {
    let loads = 0;
    const coordinator = createOlderRequestCoordinator(
      async () => {
        loads += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
      () => loads < 1,
    );
    await Promise.all([
      coordinator.requestFromNearEnd(),
      coordinator.requestFromNearEnd(),
    ]);
    expect(loads).toBe(1);
  });
});
