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
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
});

test('tile plus opens New Tab chooser', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await page.locator('.new-tab').getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(2);
});
