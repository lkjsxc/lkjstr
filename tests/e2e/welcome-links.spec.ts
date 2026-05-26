import { expect, test } from '@playwright/test';

test('welcome document links open core tool tabs', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('region', { name: 'Welcome' });
  await expect(
    welcome.getByRole('heading', { name: 'Core surfaces' }),
  ).toBeVisible();
  const welcomePane = page.locator('.pane').filter({
    has: page.getByRole('tab', { name: 'Welcome' }),
  });
  await welcome.getByRole('button', { name: 'Open Accounts' }).click();
  await expect(
    welcomePane.locator('.pane-body [aria-label="Accounts"]'),
  ).toBeVisible();
  await welcomePane.getByRole('tab', { name: 'Welcome' }).click();
  await welcome.getByRole('button', { name: 'Home' }).click();
  await expect(
    welcomePane.locator('.pane-body [aria-label="Home"]'),
  ).toBeVisible();
});
