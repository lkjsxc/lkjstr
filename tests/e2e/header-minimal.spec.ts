import { expect, test } from '@playwright/test';

test('header is minimal and left tab menu is absent', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Application header')).toContainText('lkjstr');
  await expect(page.getByLabel('Application header')).toContainText('dev');
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/lkjsxc/lkjstr',
  );
  await expect(page.getByLabel('Activity')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Toggle sidebar' }),
  ).toHaveCount(0);
  await expect(page.getByText('Workspace saved')).toHaveCount(0);
});
