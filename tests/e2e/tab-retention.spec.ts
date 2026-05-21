import { expect, test, type Page } from '@playwright/test';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('retains inactive tab body after switching tabs', async ({ page }) => {
  await page.goto('/');
  await selectStartupTab(page, 'Home');
  await expect(page.locator('.timeline-tab')).toHaveCount(1);
  await openNewTabOption(page, 'Settings', 1);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.timeline-tab')).toHaveCount(1);
});

test('retains tab scroll briefly and removes inactive body after expiry', async ({
  page,
}) => {
  await page.goto('/');
  await selectStartupTab(page, 'Home');
  await openNewTabOption(page, 'Settings', 1);
  await page.getByLabel('Edit tabs.inactiveRetentionSeconds').fill('3');
  await page.waitForTimeout(100);
  const before = await setSettingsScroll(page);
  expect(before).toBeGreaterThan(0);
  await selectStartupTab(page, 'Home');
  await selectStartupTab(page, 'Settings');
  await expect.poll(() => getSettingsScroll(page)).toBeGreaterThan(0);
  await selectStartupTab(page, 'Home');
  await expect(page.locator('.settings-tab')).toHaveCount(1);
  await expect(page.locator('.settings-tab')).toHaveCount(0, {
    timeout: 4500,
  });
});

async function setSettingsScroll(page: Page) {
  return page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => {
      node.scrollTop = 500;
      return node.scrollTop;
    });
}

async function getSettingsScroll(page: Page) {
  return page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => node.scrollTop);
}
