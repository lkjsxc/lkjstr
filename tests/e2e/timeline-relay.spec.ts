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
} from './timeline-relay-helpers';

test('timeline does not read public relays without an active account', async ({
  page,
}) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await expect(page.getByText('Add or activate an account')).toBeVisible();
  await page.evaluate(() => {
    window.__syntheticSockets.length = 0;
  });
  await page.waitForTimeout(100);
  const socketCount = await page.evaluate(
    () => window.__syntheticSockets.length,
  );
  expect(socketCount).toBe(0);
});

test('timeline displays followed-author notes from a synthetic relay', async ({
  page,
}) => {
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
  await expect(page.getByText('synthetic account-home note')).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page
      .locator('button.identity-button')
      .filter({ hasText: 'Followed Writer' }),
  ).toBeVisible();
  await expect(page.getByText(note.id.slice(0, 8))).toBeVisible();
  await expect(page.getByText(followed)).toHaveCount(0);
  await page
    .locator('button.identity-button')
    .filter({ hasText: 'Followed Writer' })
    .click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByText('synthetic account-home note').click();
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
