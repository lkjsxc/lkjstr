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
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test.setTimeout(90000);

test('workspace churn keeps owned heap and counters bounded', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', author]], content: '' },
    activeKey,
  );
  const events = Array.from({ length: 180 }, (_, index) =>
    finalizeEvent(
      {
        created_at: now - index,
        kind: 1,
        tags: index % 4 === 0 ? [['p', active]] : [],
        content: `memory churn signed note ${index}`,
      },
      authorKey,
    ),
  );

  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await installSyntheticRelay(page, { events: [followList, ...events] });
  await page.reload();
  await enableRuntimeCounters(page);
  const baselineHeap = await ownedHeap(page);

  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, events.at(-1)!.id);
  await openNewTabOption(page, 'Settings', 1);
  await selectStartupTab(page, 'Home');
  await expect(page.locator('.settings-tab')).toHaveCount(0);
  await selectStartupTab(page, 'Settings');
  await closeTab(page, 'Settings');
  for (const name of [
    'Global',
    'Notifications',
    'Search',
    'Custom Request',
    'Relay Settings',
    'Stats',
    'lkjstr Log',
  ]) {
    await openNewTabOption(page, name, 1);
    await exerciseSurface(page, name);
    await closeTab(page, name);
  }
  await page.waitForTimeout(1400);
  await forceGc(page);

  const heap = await ownedHeap(page);
  if (heap !== undefined && baselineHeap !== undefined)
    expect(heap - baselineHeap).toBeLessThan(80 * 1024 * 1024);
  await openNewTabOption(page, 'Stats', 1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('timeline:home')).toBeVisible();
  const keys = await page
    .getByRole('heading', { name: 'Runtime counters' })
    .locator('xpath=following-sibling::table[1]//tbody/tr/td[1]')
    .allTextContents();
  expect(keys.sort()).toEqual([
    'subscription-manager',
    'timeline',
    'timeline:global',
    'timeline:home',
  ]);
});

async function enableRuntimeCounters(page: Page): Promise<void> {
  await openNewTabOption(page, 'Settings', 1);
  await page.getByLabel('Edit tabs.inactiveRetentionSeconds').fill('1');
  await page.getByLabel('Edit debug.showRuntimeCounters').check();
  await closeTab(page, 'Settings');
  await openNewTabOption(page, 'Stats', 1);
  await page.getByRole('button', { name: 'Refresh counters' }).click();
  await closeTab(page, 'Stats');
}

async function exerciseSurface(page: Page, name: string): Promise<void> {
  if (name === 'Search') {
    await page.getByLabel('Search query').fill('memory churn');
    await page.locator('form').getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(300);
  }
  if (name === 'Custom Request') {
    await page.getByRole('button', { name: 'Run' }).click();
    await page.waitForTimeout(300);
  }
  if (name === 'Stats')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
}

async function closeTab(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name: `Close ${name}` }).last();
  if ((await button.count()) > 0) await button.click();
}

async function ownedHeap(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () =>
      (performance as Performance & { memory?: { usedJSHeapSize?: number } })
        .memory?.usedJSHeapSize,
  );
}

async function forceGc(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.collectGarbage');
  await session.detach();
}
