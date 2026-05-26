import { expect, test } from '@playwright/test';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('restores Home scroll anchor after tab switch within retention', async ({
  page,
}) => {
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Home');
  await page.getByLabel('Edit tabs.inactiveRetentionSeconds').fill('120');
  const scrolled = await page
    .locator('.event-list__scroller')
    .evaluate((node) => {
      node.scrollTop = 240;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
      return node.scrollTop;
    });
  expect(scrolled).toBeGreaterThan(0);
  await openNewTabOption(page, 'Settings', 1);
  await selectStartupTab(page, 'Home');
  await expect
    .poll(() =>
      page.locator('.event-list__scroller').evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(0);
});
