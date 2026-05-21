import { expect, test, type Page } from '@playwright/test';

test('drags a tab from one tile to another', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('persists a moved tab after reload', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await page.reload();
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
});

async function moveSettingsTabToSecondTile(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await secondPane(page).getByRole('button', { name: 'Open new tab' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await secondPane(page)
    .getByRole('tab', { name: 'Settings', exact: true })
    .dragTo(firstPane(page).locator('.tab-frame').first());
}

function firstPane(page: Page) {
  return page.locator('.pane').nth(0);
}

function secondPane(page: Page) {
  return page.locator('.pane').nth(1);
}
