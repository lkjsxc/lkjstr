import { expect, test, type Page } from '@playwright/test';

test('drags a tab from one tile to another', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await expect(
    firstPane(page).locator('.tab-frame', { hasText: 'Settings' }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).locator('.tab-frame', { hasText: 'Settings' }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('persists a moved tab after reload', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await page.reload();
  await expect(
    firstPane(page).locator('.tab-frame', { hasText: 'Settings' }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).locator('.tab-frame', { hasText: 'Settings' }),
  ).toHaveCount(0);
});

async function moveSettingsTabToSecondTile(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await secondPane(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await secondPane(page)
    .locator('.tab-frame', { hasText: 'Settings' })
    .dragTo(firstPane(page).locator('.tab-frame').first());
}

function firstPane(page: Page) {
  return page.locator('.pane').nth(0);
}

function secondPane(page: Page) {
  return page.locator('.pane').nth(1);
}
