import { expect, test } from '@playwright/test';

test('opens and searches settings', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Activity')
    .getByRole('button', { name: 'Settings' })
    .click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('Search settings').fill('workspace.route');
  await expect(
    page.getByRole('button', { name: 'workspace.route' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'appearance.radius.button' }),
  ).toHaveCount(0);
});
