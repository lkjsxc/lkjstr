import { expect, test } from '@playwright/test';
import { pane } from './workspace-helpers';

test('closing the final tab recovers a usable tile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Close Welcome' }).click();
  await expect(page.getByRole('tab', { name: 'Accounts' })).toBeVisible();
  await expect(page.locator('.pane')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('heading', { name: 'Empty workspace' }),
  ).toHaveCount(0);
});

test('closing the final tile recovers a usable tile', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Tile close' }).click();
  await expect(page.getByRole('tab', { name: 'Accounts' })).toBeVisible();
});
