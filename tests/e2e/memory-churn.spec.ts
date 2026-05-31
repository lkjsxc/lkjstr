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

  await installSyntheticRelay(page, { events: [followList, ...events] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('memory churn signed note 0')).toBeVisible({
    timeout: 15_000,
  });
  await enableDebugCounters(page);
  await selectStartupTab(page, 'Home');
  await enableShortRetention(page);
  const baselineHeap = await ownedHeap(page);
  await openNewTabOption(page, 'Settings', 1);
  await selectStartupTab(page, 'Home');
  await expect(
    page.locator('.pane-body[data-active-tab="true"] .settings-tab'),
  ).toHaveCount(0);
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

  const counters = await waitForZeroCounters(page, [
    'active-paged-reads',
    'queued-read-waiters',
    'active-relay-publish-waiters',
    'active-abort-listeners',
    'active-indexeddb-ops',
  ]);
  for (const key of [
    'active-paged-reads',
    'queued-read-waiters',
    'active-relay-publish-waiters',
    'active-abort-listeners',
    'active-indexeddb-ops',
  ] as const) {
    expect(counters[key] ?? 0, `${key} after churn`).toBe(0);
  }
  await selectStartupTab(page, 'Home');
  await page.waitForTimeout(400);
  await openNewTabOption(page, 'Stats', 1);
  await page.getByRole('button', { name: 'Refresh storage inventory' }).click();
  await expect(
    page.getByRole('heading', { name: 'Runtime counters' }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Refresh counters' }).click();
  const keys = await page
    .getByRole('heading', { name: 'Runtime counters' })
    .locator('xpath=following-sibling::table[1]//tbody/tr/td[1]')
    .allTextContents();
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.length).toBeLessThanOrEqual(11);
});

async function enableDebugCounters(page: Page): Promise<void> {
  await openNewTabOption(page, 'Settings', 1);
  await page.getByLabel('Edit debug.showRuntimeCounters').check();
  await closeTab(page, 'Settings');
}

async function enableShortRetention(page: Page): Promise<void> {
  await openNewTabOption(page, 'Settings', 1);
  await page.getByLabel('Edit tabs.inactiveRetentionSeconds').fill('1');
  await closeTab(page, 'Settings');
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
    await page
      .getByRole('button', { name: 'Refresh storage inventory' })
      .click();
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

async function waitForZeroCounters(
  page: Page,
  keys: readonly string[],
): Promise<Record<string, number>> {
  let settled: Record<string, number> = {};
  try {
    await expect
      .poll(
        async () => {
          settled = await idleCounterSnapshot(page, keys);
          return Math.max(...keys.map((key) => settled[key] ?? 0));
        },
        { timeout: 10000 },
      )
      .toBe(0);
    return settled;
  } catch (error) {
    console.info(
      'memory counter debug',
      await page.evaluate(() => window.__lkjstrMemoryDebug?.()),
    );
    throw error;
  }
}

async function idleCounterSnapshot(
  page: Page,
  keys: readonly string[],
): Promise<Record<string, number>> {
  const first = await readCounters(page);
  if (Math.max(...keys.map((key) => first[key] ?? 0)) === 0) return first;
  await page.waitForTimeout(75);
  return readCounters(page);
}

async function readCounters(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const debug = window.__lkjstrMemoryDebug?.();
    return (debug?.counters ?? {}) as Record<string, number>;
  });
}
