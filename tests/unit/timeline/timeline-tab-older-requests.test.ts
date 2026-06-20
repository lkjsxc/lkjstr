import { describe, expect, it } from 'vitest';
import { createTimelineOlderRequestCoordinator } from '../../../src/lib/tabs/timeline/timeline-tab-older-requests';

describe('timeline older request coordinator', () => {
  it('loads twice when more history remains after the first page', async () => {
    let loads = 0;
    let hasOlder = true;
    const coordinator = createTimelineOlderRequestCoordinator(
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
    const coordinator = createTimelineOlderRequestCoordinator(
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
