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
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('Stats labels active subscriptions and orchestration counters', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000) - 5;
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', author]], content: '' },
    activeKey,
  );
  const note = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['p', active]],
      content: 'stats labeled subscription note',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, note.id);
  await expect(page.getByText('stats labeled subscription note')).toBeVisible({
    timeout: 15_000,
  });

  await openNewTabOption(page, 'Stats', 0);

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible();
  await expect(page.getByText('active demands')).toBeVisible();
  await expect(page.getByText('active leases')).toBeVisible();
  await expect(page.getByText('live leases')).toBeVisible();
  await expect(page.getByText('bootstrap/page reads')).toBeVisible();
});
