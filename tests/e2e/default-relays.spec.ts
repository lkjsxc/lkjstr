import { expect, test } from '@playwright/test';

test('shows seeded default relays', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Activity')
    .getByRole('button', { name: 'Relays' })
    .click();
  await expect(page.getByRole('heading', { name: 'Relays' })).toBeVisible();
  await expect(page.getByText('Damus', { exact: true })).toBeVisible();
  await expect(page.getByText('wss://relay.damus.io')).toBeVisible();
});
