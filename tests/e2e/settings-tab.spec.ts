import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

test('opens flat settings without filter UI', async ({ page }) => {
  await page.goto('/');
  await openNewTabOption(page, 'Settings');
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
  await expect(page.getByLabel('Search settings')).toHaveCount(0);
  await expect(page.getByText('appearance.cornerRadius')).toBeVisible();
  await expect(page.getByText('tabs.inactiveRetentionSeconds')).toBeVisible();
  await expect(page.getByText('timeline.initialLimit')).toBeVisible();
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await expect(page.getByLabel('Settings JSON import')).toBeVisible();
});

test('Stats uses a checkbox for auto refresh', async ({ page }) => {
  await page.goto('/');
  await openNewTabOption(page, 'Stats');
  await expect(page.getByRole('region', { name: 'Stats' })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /Auto refresh/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto 2s' })).toHaveCount(0);
});

test('Stats refresh stays mounted when storage diagnostics fail', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.addInitScript(() => {
    const state = window as Window & { __lkjstrUnhandledRejections?: string[] };
    state.__lkjstrUnhandledRejections = [];
    window.addEventListener('unhandledrejection', (event) => {
      state.__lkjstrUnhandledRejections?.push(String(event.reason));
    });
  });
  await page.goto('/');
  await openNewTabOption(page, 'Stats');
  await expect(page.getByRole('region', { name: 'Stats' })).toBeVisible();
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = function () {
      const error = new DOMException(
        "Failed to execute 'objectStore' on 'IDBTransaction'",
        'NotFoundError',
      );
      throw error;
    } as typeof IDBDatabase.prototype.transaction;
  });
  await page.getByRole('button', { name: 'Refresh storage inventory' }).click();
  await expect(page.getByRole('region', { name: 'Stats' })).toBeVisible();
  const unhandled = await page.evaluate(
    () =>
      (window as Window & { __lkjstrUnhandledRejections?: string[] })
        .__lkjstrUnhandledRejections ?? [],
  );
  expect(errors).toHaveLength(0);
  expect(unhandled).toEqual([]);
});
