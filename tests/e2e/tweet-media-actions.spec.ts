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
import { selectStartupTab } from './workspace-helpers';

test('Ctrl+Enter publishes a Tweet through the relay', async ({ page }) => {
  const key = generateSecretKey();
  const pubkey = getPublicKey(key);
  await installNip07(page, pubkey);
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await addBrowserSigner(page);
  await openTweet(page);
  await page.getByLabel('Tweet content').fill('keyboard publish');
  await page.getByLabel('Tweet content').press('Control+Enter');
  await expect(page.getByLabel('Tweet content')).toHaveValue('');
  await expect(page.getByText(/Sent to|Published/)).toHaveCount(0);
  await expect(page.getByText('Attach emoji')).toHaveCount(0);
  expect(await publishedKinds(page)).toContain(1);
});
test('event row actions publish without opening the row thread', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const now = Math.floor(Date.now() / 1000);
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', followed]], content: '' },
    activeKey,
  );
  const note = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'action target note' },
    followedKey,
  );
  const metadata = finalizeEvent(
    {
      created_at: now,
      kind: 0,
      tags: [],
      content: JSON.stringify({
        display_name: 'Zap Writer',
        lud16: 'zap@example.com',
      }),
    },
    followedKey,
  );
  await installNip07(page, active);
  await installSyntheticRelay(page, { events: [followList, note, metadata] });
  await mockZapServer(page);
  await openCleanWorkspace(page);
  await addBrowserSigner(page);
  await selectStartupTab(page, 'Home');
  await waitForSyntheticEvent(page, note.id);
  const row = page
    .locator('.event-row')
    .filter({ hasText: 'action target note' });
  await row.getByRole('button', { name: 'Heart', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Thread' })).toHaveCount(0);
  await waitForPublishedCount(page, 1);
  await row.getByRole('button', { name: 'Reply', exact: true }).click();
  await row.getByLabel('Reply').fill('inline reply');
  await row.getByRole('button', { name: 'Publish reply' }).click();
  await waitForPublishedCount(page, 2);
  await row.getByRole('button', { name: 'Emoji', exact: true }).click();
  await row.locator('emoji-picker').evaluate((picker) =>
    picker.dispatchEvent(
      new CustomEvent('emoji-click', {
        detail: { unicode: '👍' },
        bubbles: true,
      }),
    ),
  );
  await waitForPublishedCount(page, 3);
  await row.getByRole('button', { name: 'Repost', exact: true }).click();
  await waitForPublishedCount(page, 4);
  await row.getByRole('button', { name: 'Zap', exact: true }).click();
  await row.getByRole('button', { name: 'Invoice' }).click();
  await expect(row.getByText('Invoice ready.')).toBeVisible();
  expect(await publishedKinds(page)).toEqual(expect.arrayContaining([1, 6, 7]));
});

async function addBrowserSigner(page: import('@playwright/test').Page) {
  await selectStartupTab(page, 'Accounts');
  await page.getByRole('button', { name: 'Add NIP-07' }).click();
  await expect(page.getByText('nip07')).toBeVisible();
  await selectStartupTab(page, 'Home');
}

async function openTweet(page: import('@playwright/test').Page) {
  await selectStartupTab(page, 'Tweet');
}

async function mockZapServer(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/.well-known/lnurlp/'))
        return Response.json({ callback: 'https://example.com/callback' });
      return Response.json({ pr: 'lnbc1invoice' });
    };
  });
}

async function publishedKinds(page: import('@playwright/test').Page) {
  const events = await page.evaluate(() =>
    window.__syntheticSockets.flatMap((socket) =>
      Array.isArray((socket as { published?: unknown[] }).published)
        ? (socket as { published: { kind?: number }[] }).published
        : [],
    ),
  );
  return events.map((event) => event.kind);
}

async function waitForPublishedCount(
  page: import('@playwright/test').Page,
  count: number,
) {
  await page.waitForFunction(
    (minimum) =>
      window.__syntheticSockets.flatMap((socket) =>
        Array.isArray((socket as { published?: unknown[] }).published)
          ? (socket as { published: unknown[] }).published
          : [],
      ).length >= minimum,
    count,
  );
}
