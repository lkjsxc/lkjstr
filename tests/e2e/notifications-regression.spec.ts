import { expect, test, type Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('notifications viewport-fill older history when underfilled', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const authorKey = generateSecretKey();

  const now = Math.floor(Date.now() / 1000);
  // Old events are outside the initial one-minute window but close enough for
  // adaptive older viewport-fill to find them quickly.
  const oldCreatedAt = now - 3 * 60;
  const newCreatedAt = now - 30;

  const oldEvents = Array.from({ length: 4 }, (_, i) =>
    finalizeEvent(
      {
        created_at: oldCreatedAt + i,
        kind: 1,
        tags: [['p', active]],
        content: `old-notification-${i}`,
      },
      authorKey,
    ),
  );
  const newEvents = Array.from({ length: 1 }, (_, i) =>
    finalizeEvent(
      {
        created_at: newCreatedAt + i,
        kind: 1,
        tags: [['p', active]],
        content: `new-notification-${i}`,
      },
      authorKey,
    ),
  );

  await installSyntheticRelay(page, { events: [...newEvents, ...oldEvents] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Notifications');

  await expect(page.getByText('old-notification-3')).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.getByText('End of known history.')).not.toBeVisible();
});

test('notifications scan older history after an empty initial window', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const authorKey = generateSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const oldCreatedAt = now - 3 * 60;
  const oldEvents = Array.from({ length: 2 }, (_, i) =>
    finalizeEvent(
      {
        created_at: oldCreatedAt + i,
        kind: 1,
        tags: [['p', active]],
        content: `empty-initial-notification-${i}`,
      },
      authorKey,
    ),
  );

  await installSyntheticRelay(page, { events: oldEvents });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Notifications');

  await expect(page.getByText('empty-initial-notification-1')).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText('No notifications for the active account.'),
  ).not.toBeVisible();
});

test('notifications explicit retry issues older scans after bounded empty scans', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);

  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Notifications');

  const retry = page.getByRole('button', {
    name: 'Load older notifications',
  });
  await expect(retry).toBeVisible({ timeout: 20_000 });
  const repliesBefore = await relayReplyCount(page);
  await retry.dispatchEvent('click');
  await expect.poll(() => relayReplyCount(page)).toBeGreaterThan(repliesBefore);
});

async function relayReplyCount(page: Page): Promise<number> {
  return page.evaluate(() =>
    window.__syntheticSockets.reduce<number>((total, socket) => {
      const record =
        typeof socket === 'object' && socket !== null
          ? (socket as Record<string, unknown>)
          : {};
      return total + (typeof record.replies === 'number' ? record.replies : 0);
    }, 0),
  );
}
