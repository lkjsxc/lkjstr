import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';
import { openCleanWorkspace } from './timeline-relay-helpers';
import {
  cacheCounts,
  compactPressureRows,
  seedPressureRows,
} from './storage-pressure-helpers';

test('Stats compacts real SQLite cache under origin pressure', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({
          usage: 95 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        }),
      },
    });
  });
  await openCleanWorkspace(page);
  await openNewTabOption(page, 'Stats', 0);
  await expect(page.getByRole('heading', { name: 'Cache' })).toBeVisible();
  await seedPressureRows(page);
  await page.getByRole('button', { name: 'Refresh storage inventory' }).click();

  await expect(page.getByRole('cell', { name: 'nostr-event' })).toBeVisible();
  const before = await cacheCounts(page);
  expect(before.events).toBe(80);

  await compactPressureRows(page);
  await page.getByRole('button', { name: 'Refresh storage inventory' }).click();
  await expect
    .poll(async () => (await cacheCounts(page)).events, { timeout: 60_000 })
    .toBeLessThan(before.events);

  const after = await cacheCounts(page);
  expect(after.orphanLedgerRows).toBe(0);
  await expect(
    page.getByRole('row', { name: /Residual browser overhead/ }),
  ).toBeVisible();
});
