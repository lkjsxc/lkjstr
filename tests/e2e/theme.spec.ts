import { expect, test } from '@playwright/test';

test('uses dark low-radius theme', async ({ page }) => {
  await page.goto('/');
  const bodyBg = await page
    .locator('body')
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const radius = await page
    .getByRole('button', { name: 'Open new tab' })
    .first()
    .evaluate((node) => getComputedStyle(node).borderRadius);
  expect(bodyBg).toBe('rgb(11, 11, 12)');
  expect(Number.parseFloat(radius)).toBeLessThanOrEqual(2);
});
