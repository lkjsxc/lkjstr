import { expect, test } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import { installNip07 } from './nip07-helper';
import {
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test.setTimeout(60_000);

test('heart and repost show pressed state for the active account', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const authorKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const now = Math.floor(Date.now() / 1000);
  const note = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'pressed row' },
    authorKey,
  );
  await installNip07(page, active);
  await installSyntheticRelay(page, { events: [note] });
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Accounts');
  await page.getByRole('button', { name: 'Log in with NIP-07' }).click();
  await expect(page.getByText('nip07')).toBeVisible();
  await openNewTabOption(page, 'Global');
  await waitForSyntheticEvent(page, note.id);
  const row = page
    .locator('.event-row')
    .filter({ hasText: 'pressed row' })
    .first();
  await row.getByRole('button', { name: 'Heart', exact: true }).click();
  await waitForPublishedCount(page, 1);
  await expect
    .poll(
      () =>
        row
          .getByRole('button', { name: 'Heart', exact: true })
          .getAttribute('aria-pressed'),
      { timeout: 15_000 },
    )
    .toBe('true');
  await expectPressedStable(page, row, 'Heart');
  await row.getByRole('button', { name: 'Repost', exact: true }).click();
  await waitForPublishedCount(page, 2);
  await expect
    .poll(() =>
      row
        .getByRole('button', { name: 'Repost', exact: true })
        .getAttribute('aria-pressed'),
    )
    .toBe('true');
  await expectPressedStable(page, row, 'Repost');
});

async function expectPressedStable(
  page: import('@playwright/test').Page,
  row: import('@playwright/test').Locator,
  name: string,
): Promise<void> {
  const button = row.getByRole('button', { name, exact: true });
  for (let index = 0; index < 5; index += 1) {
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(100);
  }
}

async function waitForPublishedCount(
  page: import('@playwright/test').Page,
  count: number,
): Promise<void> {
  await page.waitForFunction(
    (expected) =>
      (window.__syntheticSockets ?? []).some(
        (socket) =>
          typeof socket === 'object' &&
          socket !== null &&
          'published' in socket &&
          Array.isArray((socket as { published: unknown[] }).published) &&
          (socket as { published: unknown[] }).published.length >= expected,
      ),
    count,
  );
}
