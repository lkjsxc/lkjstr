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
import { encodeNote, encodeNpub } from '../../src/lib/protocol/nip19';

test('timeline does not read public relays without an active account', async ({
  page,
}) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await selectStartupTab(page, 'Home');
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
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, note.id);
  await expect(page.getByText('synthetic account-home note')).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page
      .locator('button.identity-button')
      .filter({ hasText: 'Followed Writer' }),
  ).toBeVisible();
  await expect(page.getByText(note.id.slice(0, 8))).toHaveCount(0);
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
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, note.id);
  const profileMention = page.getByRole('button', {
    name: `nostr:${encodeNpub(mentioned)}`,
    exact: true,
  });
  await expect(profileMention).toBeVisible();
  await expect(profileMention).toHaveClass(/content-mention-token/);
  await expect
    .poll(() =>
      profileMention.evaluate(
        (element) => getComputedStyle(element).textDecorationLine,
      ),
    )
    .toContain('underline');
  await profileMention.click();
  await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible();
  await selectStartupTab(page, 'Home');
  const reference = page.locator('.event-embed').filter({
    hasText: 'Referenced event',
  });
  await reference.getByText('linked event body').click();
  await expect(page.getByRole('region', { name: 'Thread' })).toBeVisible();
});

test('search opens empty and waits for manual input with an active account', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.evaluate(() => {
    window.__syntheticSockets.length = 0;
  });

  await openNewTabOption(page, 'Search', 1);
  await expect(page.getByLabel('Search query')).toHaveValue('');
  await expect(page.getByText('Enter a search query.')).toBeVisible();
  await page.waitForTimeout(150);
  const searchRequests = await page.evaluate(() =>
    window.__syntheticSockets.flatMap((socket) =>
      typeof socket === 'object' &&
      socket !== null &&
      Array.isArray((socket as { sent?: unknown }).sent)
        ? (socket as { sent: string[] }).sent.filter((message) =>
            message.includes('"search"'),
          )
        : [],
    ),
  );
  expect(searchRequests).toEqual([]);
});
