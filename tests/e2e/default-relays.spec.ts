import { expect, test } from '@playwright/test';
import { selectStartupTab } from './workspace-helpers';
import { openCleanWorkspace } from './timeline-relay-helpers';

test('shows seeded default relays', async ({ page }) => {
  await page.goto('/');
  await selectStartupTab(page, 'Relay Settings');
  await expect(
    page.getByRole('region', { name: 'Relay Settings' }),
  ).toBeVisible();
  const userRelays = page.getByRole('region', { name: 'User relays' });
  const discoveryRelays = page.getByRole('region', {
    name: 'Discovery relays',
  });
  await expect(userRelays).toBeVisible();
  await expect(discoveryRelays).toBeVisible();
  await expect(
    userRelays.getByRole('textbox', { name: 'Label wss://relay.damus.io' }),
  ).toHaveValue('Damus');
  await expect(userRelays.getByText('wss://relay.damus.io')).toBeVisible();
  await expect(page.getByText('wss://relay.nostr.band')).toHaveCount(0);
  await expect(userRelays.getByText('wss://r.kojira.io')).toBeVisible();
  await expect(userRelays.getByText('wss://x.kojira.io')).toBeVisible();
  await expect(userRelays.getByText('wss://yabu.me')).toBeVisible();
  await expect(
    userRelays.getByRole('textbox', {
      name: 'Label wss://relay-jp.nostr.wirednet.jp',
    }),
  ).toHaveValue('Kiri Japan');
  await expect(
    userRelays.getByRole('textbox', {
      name: 'Label wss://relay.nostr.wirednet.jp',
    }),
  ).toHaveValue('Kiri World');
  await expect(discoveryRelays.getByText('wss://purplepag.es/')).toBeVisible();
  await expect(
    discoveryRelays.getByText('wss://directory.yabu.me/'),
  ).toBeVisible();
  await expect(discoveryRelays.getByLabel('read')).toHaveCount(0);
  await expect(discoveryRelays.getByLabel('write')).toHaveCount(0);
});

test('edits and restores discovery relays independently', async ({ page }) => {
  await page.route('https://purplepag.es/', (route) =>
    route.fulfill({
      json: {
        name: 'Purple Pages',
        software: 'relay',
        supported_nips: [11, 65],
      },
    }),
  );
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Relay Settings');
  const discoveryRelays = page.getByRole('region', {
    name: 'Discovery relays',
  });
  let purpleRow = discoveryRelays
    .locator('.row')
    .filter({ hasText: 'wss://purplepag.es/' });
  await expect(purpleRow).toBeVisible();
  await purpleRow.getByLabel('enabled').uncheck();
  await expect(purpleRow.getByLabel('enabled')).not.toBeChecked();

  await purpleRow.getByRole('button', { name: 'Remove' }).click();
  await expect(purpleRow).toHaveCount(0);
  await discoveryRelays
    .getByRole('button', { name: 'Restore defaults' })
    .click();
  purpleRow = discoveryRelays
    .locator('.row')
    .filter({ hasText: 'wss://purplepag.es/' });
  await expect(purpleRow).toBeVisible();

  await purpleRow.getByRole('button', { name: 'Fetch info' }).click();
  await expect(purpleRow.getByText('Purple Pages relay')).toBeVisible();
});
