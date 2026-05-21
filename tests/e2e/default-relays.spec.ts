import { expect, test } from '@playwright/test';
import { selectStartupTab } from './workspace-helpers';

test('shows seeded default relays', async ({ page }) => {
  await page.goto('/');
  await selectStartupTab(page, 'Relay Settings');
  await expect(
    page.getByRole('region', { name: 'Relay Settings' }),
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
