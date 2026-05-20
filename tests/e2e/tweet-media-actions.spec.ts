import { expect, test } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { installNip07 } from './nip07-helper';
import {
  installSyntheticRelay,
  openCleanWorkspace,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';

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
  await expect(page.getByText(/Published to/)).toBeVisible();
  expect(await publishedKinds(page)).toContain(1);
});

test('Tweet media upload publishes content and imeta tags', async ({
  page,
}) => {
  const key = generateSecretKey();
  const pubkey = getPublicKey(key);
  await installNip07(page, pubkey);
  await installSyntheticRelay(page, { events: [] });
  await mockUploadServer(page);
  await openCleanWorkspace(page);
  await addBrowserSigner(page);
  await setMediaServer(page);
  await openTweet(page);
  await page.getByLabel('Tweet content').fill('media note');
  await page.locator('input#tweet-media').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('png'),
  });
  await expect(page.getByText('Uploaded 1 media file')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await waitForPublishedCount(page, 1);
  const published = await lastPublished(page);
  expect(published?.content).toContain('https://cdn.example/pixel.png');
  expect(published?.tags).toContainEqual([
    'imeta',
    'url https://cdn.example/pixel.png',
    'm image/png',
  ]);
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
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await waitForSyntheticEvent(page, note.id);
  const row = page
    .locator('.event-row')
    .filter({ hasText: 'action target note' });
  await row.getByRole('button', { name: 'Heart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thread' })).toHaveCount(0);
  await waitForPublishedCount(page, 1);
  await row.getByRole('button', { name: 'Reply', exact: true }).click();
  await row.getByLabel('Reply').fill('inline reply');
  await row.getByRole('button', { name: 'Publish reply' }).click();
  await waitForPublishedCount(page, 2);
  await row.getByRole('button', { name: 'Emoji', exact: true }).click();
  await row.getByLabel('Emoji reaction').fill('+1');
  await row.getByRole('button', { name: 'React' }).click();
  await waitForPublishedCount(page, 3);
  await row.getByRole('button', { name: 'Repost', exact: true }).click();
  await waitForPublishedCount(page, 4);
  await row.getByRole('button', { name: 'Zap', exact: true }).click();
  await row.getByRole('button', { name: 'Invoice' }).click();
  await expect(row.getByText('Invoice ready.')).toBeVisible();
  expect(await publishedKinds(page)).toEqual(expect.arrayContaining([1, 6, 7]));
});

async function addBrowserSigner(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: 'Add NIP-07' }).click();
  await expect(page.getByText('nip07')).toBeVisible();
}

async function openTweet(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Tweet' }).click();
}

async function setMediaServer(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByLabel('Edit tweet.mediaUploadServer')
    .fill('https://media.example');
  await page.getByLabel('Edit tweet.mediaUploadServer').blur();
}

async function mockUploadServer(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/.well-known/nostr/nip96.json'))
        return Response.json({ api_url: 'https://media.example/upload' });
      return Response.json({
        nip94_event: {
          tags: [
            ['url', 'https://cdn.example/pixel.png'],
            ['m', 'image/png'],
          ],
        },
      });
    };
  });
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

async function lastPublished(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const events = window.__syntheticSockets.flatMap((socket) =>
      Array.isArray((socket as { published?: unknown[] }).published)
        ? (socket as { published: unknown[] }).published
        : [],
    );
    return events.at(-1) as { kind: number; content: string; tags: string[][] };
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
