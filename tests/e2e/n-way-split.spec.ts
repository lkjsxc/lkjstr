import { expect, test } from '@playwright/test';

test('creates N-way splits and preserves them after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await page.getByRole('button', { name: 'Open tile menu' }).nth(1).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
});
