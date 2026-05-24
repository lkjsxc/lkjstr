import { expect, test, type Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test.setTimeout(60000);

test('heavy feed keeps app heap below the smoke limit', async ({ page }) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', author]], content: '' },
    activeKey,
  );
  const events = Array.from({ length: 1200 }, (_, index) =>
    finalizeEvent(
      {
        created_at: now - index,
        kind: 1,
        tags: [],
        content: `heavy-feed signed note ${index}`,
      },
      authorKey,
    ),
  );

  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await installSyntheticRelay(page, { events: [followList, ...events] });
  await page.reload();
  const baselineHeap = await usedHeap(page);
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, events.at(-1)!.id);
  await expect(page.getByText('heavy-feed signed note 0')).toBeVisible({
    timeout: 30000,
  });

  const heap = await usedHeap(page);
  if (heap !== undefined)
    expect(heap - (baselineHeap ?? 0)).toBeLessThan(100 * 1024 * 1024);
});

async function usedHeap(page: Page) {
  return page.evaluate(() => {
    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      }
    ).memory;
    return memory?.usedJSHeapSize;
  });
}
