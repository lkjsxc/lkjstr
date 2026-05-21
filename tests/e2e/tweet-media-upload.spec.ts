import { expect, test, type Page } from '@playwright/test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { installNip07 } from './nip07-helper';
import {
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

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
  await tweetTab(page)
    .locator('input[type="file"]')
    .setInputFiles({
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

async function addBrowserSigner(page: Page) {
  await selectStartupTab(page, 'Accounts');
  await page.getByRole('button', { name: 'Add NIP-07' }).click();
}

async function openTweet(page: Page) {
  await selectStartupTab(page, 'Tweet');
}

async function setMediaServer(page: Page) {
  await openNewTabOption(page, 'Upload Settings');
  await page.getByRole('radio', { name: 'Custom' }).check();
  await page.getByLabel('Custom upload server').fill('https://media.example');
  await page.getByLabel('Custom upload server').blur();
  await page.getByRole('button', { name: 'Test discovery' }).click();
  await expect(page.getByText(/Discovery OK/)).toBeVisible();
}

function tweetTab(page: Page) {
  return page.locator('section').filter({
    has: page.getByLabel('Tweet content'),
  });
}

async function mockUploadServer(page: Page) {
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

async function lastPublished(page: Page) {
  return page.evaluate(() => {
    const events = window.__syntheticSockets.flatMap((socket) =>
      Array.isArray((socket as { published?: unknown[] }).published)
        ? (socket as { published: unknown[] }).published
        : [],
    );
    return events.at(-1) as { kind: number; content: string; tags: string[][] };
  });
}

async function waitForPublishedCount(page: Page, count: number) {
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
