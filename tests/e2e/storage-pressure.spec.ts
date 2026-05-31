import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { cacheCounts, seedPressureRows } from './storage-pressure-helpers';

test('Stats compacts real IndexedDB cache under origin pressure', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({
          usage: 3 * 1024 * 1024,
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
  expect(before.events).toBe(3);
  expect(before.protectedSettings).toBe(1);
  expect(before.protectedSecrets).toBe(1);
  expect(before.protectedWorkspaces).toBe(1);
  expect(before.protectedRelaySets).toBe(1);

  await page.getByRole('button', { name: 'Compact now' }).click();
  await expect
    .poll(async () => (await cacheCounts(page)).events, { timeout: 15_000 })
    .toBeLessThan(before.events);

  const after = await cacheCounts(page);
  expect(after.protectedSettings).toBe(1);
  expect(after.protectedSecrets).toBe(1);
  expect(after.protectedWorkspaces).toBe(1);
  expect(after.protectedRelaySets).toBe(1);
  expect(after.orphanLedgerRows).toBe(0);
  await expect(
    page.getByRole('row', { name: 'Pressure state unknown-unowned-usage' }),
  ).toBeVisible();
  await expect(
    page.getByRole('row', { name: /Residual browser overhead/ }),
  ).toBeVisible();
});
