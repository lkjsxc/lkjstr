import { expect, test } from '@playwright/test';

test('shows seeded default relays', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Relay Settings' }).click();
  await expect(
    page.getByRole('heading', { name: 'Relay Settings' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Label wss://relay.damus.io' }),
  ).toHaveValue('Damus');
  await expect(page.getByText('wss://relay.damus.io')).toBeVisible();
  await expect(page.getByText('wss://relay.nostr.band')).toHaveCount(0);
  await expect(page.getByText('wss://r.kojira.io')).toBeVisible();
  await expect(page.getByText('wss://x.kojira.io')).toBeVisible();
  await expect(page.getByText('wss://yabu.me')).toBeVisible();
});
