import { expect, test, type Page } from '@playwright/test';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('keeps inactive tab bodies mounted but hidden after switching tabs', async ({
  page,
}) => {
  await page.goto('/');
  await selectStartupTab(page, 'Home');
  await expect(page.locator('.timeline-tab')).toHaveCount(1);
  await openNewTabOption(page, 'Settings', 1);
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
  await expect(
    page.locator('.pane-body[aria-hidden="true"] .timeline-tab'),
  ).toHaveCount(1);
});

test('restores tab scroll from mounted DOM when switching back', async ({
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
  await expect(
    page.locator('.pane-body[aria-hidden="true"] .settings-tab'),
  ).toHaveCount(1);
});

test('restores Search query after tab switch within retention', async ({
  page,
}) => {
  await openCleanWorkspace(page);
  await openNewTabOption(page, 'Search', 1);
  await page.getByLabel('Search query').fill('nostr workspace');
  await openNewTabOption(page, 'Settings', 1);
  await selectStartupTab(page, 'Search');
  await expect
    .poll(() => page.getByLabel('Search query').inputValue())
    .toBe('nostr workspace');
});

test('restores top-of-list scroll after tab switch', async ({ page }) => {
  await page.goto('/');
  await selectStartupTab(page, 'Home');
  await openNewTabOption(page, 'Settings', 1);
  await page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => {
      node.scrollTop = 400;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
  await selectStartupTab(page, 'Home');
  await selectStartupTab(page, 'Settings');
  await expect.poll(() => getSettingsScroll(page)).toBeGreaterThan(0);
  await page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
  await selectStartupTab(page, 'Home');
  await selectStartupTab(page, 'Settings');
  await expect.poll(() => getSettingsScroll(page)).toBe(0);
});

test('restores settings scroll after reload from persisted tab state', async ({
  page,
}) => {
  await openCleanWorkspace(page);
  await openNewTabOption(page, 'Settings', 1);
  const before = await setSettingsScroll(page);
  expect(before).toBeGreaterThan(0);
  await selectStartupTab(page, 'Home');
  await page.reload();
  await selectStartupTab(page, 'Settings');
  await expect
    .poll(() => getSettingsScroll(page), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

async function setSettingsScroll(page: Page) {
  return page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => {
      node.scrollTop = 500;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
      return node.scrollTop;
    });
}

async function getSettingsScroll(page: Page) {
  return page
    .locator('.pane-body[data-active-tab="true"] .settings-tab')
    .evaluate((node) => node.scrollTop);
}
