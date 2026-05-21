import { expect, test } from '@playwright/test';
import { pane } from './workspace-helpers';

test('opens the workspace and creates split panes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split down' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
});

test('opens account, notification, and tweet tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await secondPane(page)
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Notifications' }),
  ).toBeVisible();
  await secondPane(page)
    .getByRole('button', { name: 'Tweet', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Tweet' })).toBeVisible();
});

test('persists layout after reload', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toBeVisible();
});

function secondPane(page: import('@playwright/test').Page) {
  return page.locator('.pane').nth(1);
}
