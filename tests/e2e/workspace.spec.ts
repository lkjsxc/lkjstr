import { expect, test } from '@playwright/test';

test('opens the workspace and creates split panes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Open tile menu' }).first().click();
  await page.getByRole('button', { name: 'Split down' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
});

test('opens account, notification, and tweet tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(
    page.getByRole('heading', { name: 'Notifications' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Tweet' }).click();
  await expect(page.getByRole('heading', { name: 'Tweet' })).toBeVisible();
});

test('persists layout after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
});
