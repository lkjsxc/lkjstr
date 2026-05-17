import { expect, test } from '@playwright/test';

test('sidebar closes, reopens, and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByLabel('Activity')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Activity')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.getByLabel('Activity')).toBeVisible();
});
