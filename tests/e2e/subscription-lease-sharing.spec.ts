import { expect, test } from '@playwright/test';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';

test('two Home tabs share one live lease', async ({ page }) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const author = getPublicKey(authorKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', author]], content: '' },
    activeKey,
  );
  const note = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['p', active]],
      content: 'lease sharing note',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('lease sharing note')).toBeVisible({
    timeout: 15_000,
  });

  await openNewTabOption(page, 'Home', 1);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('lease sharing note')).toBeVisible({
    timeout: 15_000,
  });

  const metrics = await page.evaluate(() => {
    const debug = window.__lkjstrMemoryDebug?.();
    return debug?.orchestration ?? debug?.runtime?.orchestration;
  });
  expect(metrics?.liveLeases).toBe(1);
  expect(metrics?.activeDemands).toBeGreaterThanOrEqual(2);
});
