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
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('notifications viewport-fill older history when underfilled', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const authorKey = generateSecretKey();

  const now = Math.floor(Date.now() / 1000);
  // Old events are just outside the initial 12-minute lookback, but inside the
  // first older-page cursor (oldestLoaded - 12 minutes).
  const oldCreatedAt = now - 14 * 60;
  const newCreatedAt = now - 4 * 60;

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

  await expect(page.getByText('new-notification-0')).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.getByText('old-notification-3')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('End of known history.')).not.toBeVisible();
});
