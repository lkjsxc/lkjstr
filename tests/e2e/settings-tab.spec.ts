import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

test('opens flat settings without filter UI', async ({ page }) => {
  await page.goto('/');
  await openNewTabOption(page, 'Settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByLabel('Search settings')).toHaveCount(0);
  await expect(page.getByText('appearance.cornerRadius')).toBeVisible();
  await expect(page.getByText('tabs.inactiveRetentionSeconds')).toBeVisible();
  await expect(page.getByText('timeline.initialLimit')).toBeVisible();
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await expect(page.getByLabel('Settings JSON import')).toBeVisible();
});
