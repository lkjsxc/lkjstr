import { expect, test } from '@playwright/test';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('restores Search query from tab snapshot after tab switch', async ({
  page,
}) => {
  await openCleanWorkspace(page);
  await openNewTabOption(page, 'Search', 1);
  await page.getByLabel('Search query').fill('nostr workspace');
  await page.getByRole('button', { name: 'Search' }).click();
  await openNewTabOption(page, 'Settings', 1);
  await selectStartupTab(page, 'Search');
  await expect(page.getByLabel('Search query')).toHaveValue('nostr workspace');
});
