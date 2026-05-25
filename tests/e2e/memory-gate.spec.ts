import { expect, test, type Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import type { MemoryCounterKey } from '../../src/lib/app/memory-counters';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test.setTimeout(120000);

const zeroAfterTeardown: MemoryCounterKey[] = [
  'active-paged-reads',
  'queued-read-waiters',
  'active-relay-publish-waiters',
  'active-abort-listeners',
  'active-indexeddb-ops',
];

const cappedAfterTeardown: MemoryCounterKey[] = [
  'relay-diagnostic-summary-count',
  'profile-summary-cache-count',
  'token-cache-count',
  'notification-runtime-record-count',
  'closed-tab-snapshots',
];

test('memory gate keeps heap and counters bounded after churn', async ({
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
  const events = Array.from({ length: 400 }, (_, index) =>
    finalizeEvent(
      {
        created_at: now - index,
        kind: 1,
        tags: index % 4 === 0 ? [['p', active]] : [],
        content: `memory gate signed note ${index}`,
      },
      authorKey,
    ),
  );

  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await installSyntheticRelay(page, { events: [followList, ...events] });
  await page.reload();
  await enableShortSnapshotRetention(page);

  await forceGc(page);
  const startupHeap = await ownedHeap(page);
  const startupCounters = await readMemoryCounters(page);

  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, events.at(-1)!.id);
  await forceGc(page);
  const feedHeap = await ownedHeap(page);

  for (const name of [
    'Global',
    'Notifications',
    'Search',
    'Custom Request',
    'Relay Settings',
    'Stats',
  ]) {
    await openNewTabOption(page, name, 1);
    await exerciseSurface(page, name);
    await closeTab(page, name);
  }

  await page.waitForTimeout(1200);
  await forceGc(page);
  const churnHeap = await ownedHeap(page);
  const counters = await readMemoryCounters(page);

  if (startupHeap !== undefined && feedHeap !== undefined)
    expect(feedHeap - startupHeap).toBeLessThan(350 * 1024 * 1024);
  if (startupHeap !== undefined && churnHeap !== undefined)
    expect(churnHeap - startupHeap).toBeLessThan(80 * 1024 * 1024);

  for (const key of zeroAfterTeardown) {
    expect(counters[key], `${key} should be zero`).toBe(0);
  }
  for (const key of cappedAfterTeardown) {
    expect(counters[key], `${key} should stay bounded`).toBeLessThanOrEqual(
      key === 'relay-diagnostic-summary-count' ? 250 : 1200,
    );
  }
  expect(startupCounters['active-relay-clients']).toBeLessThanOrEqual(
    counters['active-relay-clients'] + 2,
  );
});

async function enableShortSnapshotRetention(page: Page): Promise<void> {
  await openNewTabOption(page, 'Settings', 1);
  await page.getByLabel('Edit tabs.inactiveRetentionSeconds').fill('1');
  await closeTab(page, 'Settings');
}

async function exerciseSurface(page: Page, name: string): Promise<void> {
  if (name === 'Search') {
    await page.getByLabel('Search query').fill('memory gate');
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

async function readMemoryCounters(
  page: Page,
): Promise<Record<MemoryCounterKey, number>> {
  return page.evaluate(() => {
    const debug = window.__lkjstrMemoryDebug?.();
    return debug?.counters ?? ({} as Record<MemoryCounterKey, number>);
  });
}

async function ownedHeap(page: Page): Promise<number | undefined> {
  return page.evaluate(() => {
    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      }
    ).memory;
    return memory?.usedJSHeapSize;
  });
}

async function forceGc(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.collectGarbage');
  await session.detach();
}
