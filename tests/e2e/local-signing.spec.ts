import { expect, test, type Page } from '@playwright/test';
import { encodeNsec, generateSecretKey } from '../../src/lib/protocol';
import {
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { openNewTabOption, selectStartupTab } from './workspace-helpers';

test('imports nsec and publishes Tweet without NIP-07', async ({ page }) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await importNsec(page, encodeNsec(generateSecretKey()));
  await openTweet(page);
  await page.getByLabel('Tweet content').fill('imported local publish');
  await page.getByRole('button', { name: 'Publish' }).click();
  await waitForPublishedCount(page, 1);
  expect(await lastPublished(page)).toMatchObject({
    kind: 1,
    content: 'imported local publish',
  });
});

test('generates and imports local account for Tweet publish', async ({
  page,
}) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await generateLocalAccount(page);
  await openTweet(page);
  await page.getByLabel('Tweet content').fill('created local publish');
  await page.getByRole('button', { name: 'Publish' }).click();
  await waitForPublishedCount(page, 1);
  expect(await lastPublished(page)).toMatchObject({
    kind: 1,
    content: 'created local publish',
  });
});

test('uploads selected media file and publishes imeta', async ({ page }) => {
  await installSyntheticRelay(page, { events: [] });
  await mockUploadServer(page);
  await openCleanWorkspace(page);
  await generateLocalAccount(page);
  await setMediaServer(page);
  await openTweet(page);
  await tweetTab(page)
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'preset.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg></svg>'),
    });
  await expect(page.getByText('Uploaded 1 media file')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await waitForPublishedCount(page, 1);
  const published = await lastPublished(page);
  expect(published?.content).toContain('https://cdn.example/preset.svg');
  expect(published?.tags).toContainEqual([
    'imeta',
    'url https://cdn.example/preset.svg',
    'm image/svg+xml',
  ]);
});

async function generateLocalAccount(page: Page) {
  await openAccounts(page);
  await expect(
    page.getByRole('button', { name: 'Log in with NIP-07' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create local' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Generate nsec' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('local', { exact: true })).toBeVisible();
}

async function importNsec(page: Page, nsec: string) {
  await openAccounts(page);
  await page.getByLabel('npub, hex pubkey, or nsec').fill(nsec);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('local', { exact: true })).toBeVisible();
}

async function openAccounts(page: Page) {
  await selectStartupTab(page, 'Accounts');
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
            ['url', 'https://cdn.example/preset.svg'],
            ['m', 'image/svg+xml'],
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
