import { expect, test } from '@playwright/test';

test('closing the final tab recovers a usable tile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Close Home' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('heading', { name: 'Empty workspace' }),
  ).toHaveCount(0);
});

test('closing the final tile recovers a usable tile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Tile close' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
});
