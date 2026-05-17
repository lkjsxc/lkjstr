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
    page.getByRole('button', { name: /workspace.route/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /appearance.cornerRadius/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Setting inspector')).toBeVisible();
  await page.getByLabel('Search settings').fill('timeline');
  await expect(
    page.getByRole('button', { name: /timeline.initialLimit/ }),
  ).toBeVisible();
});
