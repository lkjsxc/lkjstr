import { expect, test } from '@playwright/test';
import { pane } from './workspace-helpers';

test('creates N-way splits and preserves them after reload', async ({
  page,
}) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await pane(page, 1).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New Tab' })).toHaveCount(2);
});
