import { expect, test } from '@playwright/test';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('shows loading older footer on Home near end', async ({ page }) => {
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Home');
  await page.evaluate(() => {
    const scroller = document.querySelector('.event-list__scroller');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await expect(page.getByText('Loading older events...')).toBeVisible({
    timeout: 15_000,
  });
});

test('shows notifications footer while loading older', async ({ page }) => {
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Notifications');
  await page.locator('.notification-list').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    page.locator('.notification-list').getByText('Loading older events...'),
  ).toBeVisible({ timeout: 15_000 });
});
