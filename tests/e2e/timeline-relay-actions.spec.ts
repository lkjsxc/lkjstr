import { expect, test } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';

test('timeline row actions open profile and thread tabs', async ({ page }) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const followList = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 3,
      tags: [['p', followed]],
      content: '',
    },
    activeKey,
  );
  const note = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'synthetic account-home note',
    },
    followedKey,
  );
  const metadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({ display_name: 'Followed Writer' }),
    },
    followedKey,
  );

  await installSyntheticRelay(page, { events: [followList, note, metadata] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await waitForSyntheticEvent(page, note.id);
  const homeTimeline = page.locator('section.timeline-tab[aria-label="Home"]');
  await expect(
    homeTimeline.getByText('synthetic account-home note'),
  ).toBeVisible({ timeout: 10000 });
  await page
    .locator('button.identity-button')
    .filter({ hasText: 'Followed Writer' })
    .click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await homeTimeline.getByText('synthetic account-home note').click();
  await expect(page.getByRole('heading', { name: 'Thread' })).toBeVisible();
});

test('timeline hides relay details and exposes them in lkjstr Log', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  await installSyntheticRelay(page, {
    events: [],
    closed: ['timeline', 'blocked: synthetic close'],
  });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__syntheticSockets.filter(
        (socket) => Number((socket as { replies?: number }).replies) > 0,
      ).length >= 8,
  );
  await expect(page.getByText('No events yet.')).toBeVisible();
  await expect(
    page.getByText('closed: blocked: synthetic close').first(),
  ).toHaveCount(0);
  await expect(page.getByText('blocked: synthetic close')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page
    .locator('section.new-tab')
    .getByRole('button', { name: 'lkjstr Log' })
    .click();
  await expect(page.getByRole('heading', { name: 'lkjstr Log' })).toBeVisible();
  await expect(
    page.getByText('blocked: synthetic close').first(),
  ).toBeVisible();
  await expect(page.getByText('closed').first()).toBeVisible();
});
