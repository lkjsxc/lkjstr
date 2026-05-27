import { expect, test } from '@playwright/test';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';

test('home stays empty when follow list is missing', async ({ page }) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const now = Math.floor(Date.now() / 1000);
  const selfNote = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'only self note' },
    activeKey,
  );

  await installSyntheticRelay(page, { events: [selfNote] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText(/follow list/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('only self note')).not.toBeVisible();
});

test('home shows followed author notes when follow list exists', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', author]], content: '' },
    activeKey,
  );
  const authorNote = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['p', active]],
      content: 'author note for home',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, authorNote] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('author note for home')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/follow list/i).first()).not.toBeVisible({
    timeout: 15_000,
  });
});

test('notifications exclude self posts without p tag', async ({ page }) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000);
  const mention = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['p', active]],
      content: 'mention for notifications',
    },
    authorKey,
  );
  const selfPost = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'self post not notification' },
    activeKey,
  );

  await installSyntheticRelay(page, { events: [mention, selfPost] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Notifications');
  await expect(page.getByText('mention for notifications')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('self post not notification')).not.toBeVisible();
});
