import { expect, test } from '@playwright/test';

test('root opens the workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  await expect(page).toHaveTitle(/lkjstr workspace/);
});
