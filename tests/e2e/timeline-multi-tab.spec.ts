import { expect, test } from '@playwright/test';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { openNewTabOption, pane, selectStartupTab } from './workspace-helpers';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';

test('closing one home tab does not stop the other live tail', async ({
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
      content: 'multi tab home note',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  const body = pane(page, 1).locator('.pane-body[data-active-tab="true"]');
  await expect(body.getByText('multi tab home note')).toBeVisible({
    timeout: 15_000,
  });

  await openNewTabOption(page, 'Home', 1);
  const strip = pane(page, 1).locator('.tab-strip');
  const secondTab = strip.getByRole('button', { name: 'Home', exact: true }).last();
  await secondTab.click();
  await expect(body.getByText('multi tab home note')).toBeVisible();

  await strip.getByRole('button', { name: 'Home', exact: true }).first().click();
  await strip
    .getByRole('button', { name: /^Close Home\b/ })
    .first()
    .click();
  await page.waitForTimeout(500);

  await secondTab.click();
  await expect(body.getByText('multi tab home note')).toBeVisible();
});
