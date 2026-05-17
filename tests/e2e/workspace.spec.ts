import { expect, test } from '@playwright/test';

test('opens the workspace and creates split panes', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Split down' }).first().click();
  await expect(page.getByRole('heading', { name: 'Home' })).toHaveCount(3);
});

test('opens account, notification, profile, and post manager tabs', async ({
  page,
}) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(
    page.getByRole('heading', { name: 'Notifications' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page
    .getByLabel('Activity')
    .getByRole('button', { name: 'Posts' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Post Manager' }),
  ).toBeVisible();
});

test('persists layout after reload', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toHaveCount(2);
});
