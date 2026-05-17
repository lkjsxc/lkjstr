import { expect, test } from '@playwright/test';

test('closes all tabs and recovers through empty states', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Close Home' }).click();
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Settings' }).click();
  await page.getByRole('button', { name: 'Close pane' }).click();
  await expect(
    page.getByRole('heading', { name: 'Empty workspace' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open Timeline' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
});
