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
import { openNewTabOption, pane, selectStartupTab } from './workspace-helpers';

test('three Home tabs share one live notes lease', async ({ page }) => {
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
      content: 'three tab lease note',
    },
    authorKey,
  );

  await installSyntheticRelay(page, { events: [followList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Home');
  await expect(page.getByText('three tab lease note')).toBeVisible({
    timeout: 15_000,
  });

  await openNewTabOption(page, 'Home', 1);
  await pane(page, 1)
    .locator('.tab-strip')
    .getByRole('button', { name: 'Home', exact: true })
    .last()
    .click();
  await openNewTabOption(page, 'Home', 1);
  await pane(page, 1)
    .locator('.tab-strip')
    .getByRole('button', { name: 'Home', exact: true })
    .last()
    .click();

  await expect.poll(async () => countLiveNoteRelaySubscriptions(page)).toBe(1);
});

async function countLiveNoteRelaySubscriptions(
  page: import('@playwright/test').Page,
): Promise<number> {
  return page.evaluate(() => {
    const noteSubs = new Set<string>();
    for (const socket of window.__syntheticSockets ?? []) {
      const record = socket as { sent?: string[] };
      for (const raw of record.sent ?? []) {
        const message = JSON.parse(raw) as unknown[];
        if (message[0] !== 'REQ') continue;
        const filters = message.slice(2) as Array<{
          kinds?: number[];
          until?: number;
        }>;
        if (
          filters.some(
            (filter) =>
              Array.isArray(filter.kinds) &&
              filter.kinds.includes(1) &&
              filter.until === undefined,
          )
        ) {
          noteSubs.add(String(message[1]));
        }
      }
    }
    return noteSubs.size;
  });
}
