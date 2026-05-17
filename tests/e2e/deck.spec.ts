import { expect, test } from '@playwright/test';

test('opens the deck shell', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open deck' }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByText('Relays: user configured')).toBeVisible();
});
