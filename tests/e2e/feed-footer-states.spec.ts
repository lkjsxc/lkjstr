import { expect, test } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('shows end-of-history footer on Home after synthetic feed loads', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    {
      created_at: now,
      kind: 3,
      tags: [['p', followed]],
      content: '',
    },
    activeKey,
  );
  const notes = Array.from({ length: 35 }, (_, index) =>
    finalizeEvent(
      {
        created_at: now - index - 1,
        kind: 1,
        tags: [],
        content: `synthetic note ${index}`,
      },
      followedKey,
    ),
  );
  await installSyntheticRelay(page, { events: [followList, ...notes] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, notes.at(-1)!.id);
  await page.locator('.event-list__scroller').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByText('End of known history.')).toBeVisible({
    timeout: 15_000,
  });
});

test('shows footer status on Notifications list', async ({ page }) => {
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Notifications');
  await expect(page.locator('.notification-list')).toBeVisible();
  const status = page.locator('.notification-list .event-list__status');
  await expect(status.or(page.getByText('No notifications'))).toBeVisible();
});
