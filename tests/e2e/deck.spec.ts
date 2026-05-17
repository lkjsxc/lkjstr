import { expect, test } from '@playwright/test';

test('opens the deck shell', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Open deck' }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByText('Relays are user configured.')).toBeVisible();
});

test('configures relays and tiles locally', async ({ page }) => {
  await page.goto('/deck');
  await page.getByPlaceholder('wss://relay.example').fill('relay.example');
  await page.getByRole('button', { name: 'Add relay' }).click();
  await expect(
    page.getByText('wss://relay.example/', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Timeline tile' }).click();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toHaveCount(2);

  await page.reload();
  await expect(
    page.getByText('wss://relay.example/', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toHaveCount(2);
});

test('shows read-only account validation feedback', async ({ page }) => {
  await page.goto('/deck');
  await page.getByPlaceholder('npub or hex pubkey').fill('bad');
  await page.getByRole('button', { name: 'Read-only' }).click();
  await expect(
    page.getByText('Read-only account input is invalid.'),
  ).toBeVisible();
});
