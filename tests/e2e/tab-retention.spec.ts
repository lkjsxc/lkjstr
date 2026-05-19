import { expect, test } from '@playwright/test';

test('retains inactive tab body after switching tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.timeline-tab')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.timeline-tab')).toHaveCount(1);
});
