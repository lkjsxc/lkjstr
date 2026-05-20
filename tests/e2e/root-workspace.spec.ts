import { expect, test } from '@playwright/test';

test('root opens the workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0);
  await expect(page).toHaveTitle(/lkjstr workspace/);
});

test('root reload stays visible when browser storage is unavailable', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('localStorage denied');
      },
    });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('indexedDB denied');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  expect(await page.evaluate(() => document.body.clientHeight)).toBeGreaterThan(
    0,
  );
  await page.reload();
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  expect(errors).toHaveLength(0);
});
