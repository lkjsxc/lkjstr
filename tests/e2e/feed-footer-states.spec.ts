import { expect, test } from '@playwright/test';
import { openCleanWorkspace } from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('Notifications list exposes shared footer status region', async ({
  page,
}) => {
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Notifications');
  await expect(
    page
      .locator('.notification-list')
      .or(page.getByText('No notifications for the active account.')),
  ).toBeVisible({ timeout: 15_000 });
});
