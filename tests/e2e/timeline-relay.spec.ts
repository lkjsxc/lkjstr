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
import { encodeNote, encodeNpub } from '../../src/lib/protocol/nip19';

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
  await waitForSyntheticEvent(page, note.id);
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
});

test('content entity tokens open profile and thread tabs', async ({ page }) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const mentionedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const mentioned = getPublicKey(mentionedKey);
  const target = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'linked event body',
    },
    mentionedKey,
  );
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
      content: `token note nostr:${encodeNpub(mentioned)} nostr:${encodeNote(target.id)}`,
    },
    followedKey,
  );

  await installSyntheticRelay(page, { events: [followList, note, target] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await waitForSyntheticEvent(page, note.id);
  await page
    .getByRole('button', {
      name: `nostr:${encodeNpub(mentioned)}`,
      exact: true,
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page
    .getByRole('button', {
      name: `nostr:${encodeNote(target.id)}`,
      exact: true,
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Thread' })).toBeVisible();
});
