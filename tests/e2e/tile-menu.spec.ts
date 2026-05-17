import { expect, test } from '@playwright/test';

test('tile menu exposes split and close actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Split right' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await expect(page.getByRole('button', { name: 'Split right' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Split down' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tile close' })).toBeVisible();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toHaveCount(2);
});
