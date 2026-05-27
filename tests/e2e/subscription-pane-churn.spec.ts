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

test('orchestration counters return to baseline after pane churn', async ({
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
  const note = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['p', active]],
      content: 'pane churn note',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('pane churn note')).toBeVisible({
    timeout: 15_000,
  });

  await openNewTabOption(page, 'Global', 1);
  await selectStartupTab(page, 'Global');
  await page.waitForTimeout(500);

  const closeButtons = page.getByRole('button', { name: /^Close / });
  const count = await closeButtons.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    await closeButtons.nth(index).click();
  }
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const debug = window.__lkjstrMemoryDebug?.();
    return debug?.orchestration ?? debug?.runtime?.orchestration;
  });
  expect(metrics?.activeLeases ?? 0).toBe(0);
  expect(metrics?.liveLeases ?? 0).toBe(0);
});
