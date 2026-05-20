import { expect, test } from '@playwright/test';

test('opens flat settings without filter UI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByLabel('Search settings')).toHaveCount(0);
  await expect(page.getByText('appearance.cornerRadius')).toBeVisible();
  await expect(page.getByText('tabs.inactiveRetentionSeconds')).toBeVisible();
  await expect(page.getByText('timeline.initialLimit')).toBeVisible();
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await expect(page.getByLabel('Settings JSON import')).toBeVisible();
});
