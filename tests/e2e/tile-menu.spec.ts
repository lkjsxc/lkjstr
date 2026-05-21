import { expect, test } from '@playwright/test';
import { pane } from './workspace-helpers';

test('tile menu exposes split and close actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Split right' })).toHaveCount(
    0,
  );
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await expect(page.getByRole('button', { name: 'Split right' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Split down' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tile close' })).toBeVisible();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
});

test('tile plus opens New Tab chooser', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open new tab' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await page.locator('.new-tab').getByRole('button', { name: 'Home' }).click();
  await expect(pane(page, 0).getByRole('tab', { name: 'Home' })).toBeVisible();
});
