import { expect, test } from '@playwright/test';

test('creates N-way splits and preserves them after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3 columns' }).click();
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toHaveCount(
    2,
  );
  await page.getByRole('button', { name: '5 rows' }).first().click();
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toHaveCount(
    6,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Empty pane' })).toHaveCount(
    6,
  );
});
