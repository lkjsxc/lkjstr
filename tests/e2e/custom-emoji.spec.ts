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

test('wide custom emoji keep intrinsic shape inline and stay bounded in picker', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const now = Math.floor(Date.now() / 1000);
  const emojiUrl = 'https://emoji.test/wide.svg';
  const followList = finalizeEvent(
    { created_at: now, kind: 3, tags: [['p', followed]], content: '' },
    activeKey,
  );
  const emojiList = finalizeEvent(
    {
      created_at: now,
      kind: 10030,
      tags: [['emoji', 'wide', emojiUrl]],
      content: '',
    },
    activeKey,
  );
  const note = finalizeEvent(
    {
      created_at: now,
      kind: 1,
      tags: [['emoji', 'wide', emojiUrl]],
      content: 'wide custom emoji :wide: in text',
    },
    followedKey,
  );

  await page.route(emojiUrl, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="100"><rect width="600" height="100" fill="red"/></svg>',
    }),
  );
  await installSyntheticRelay(page, { events: [followList, emojiList, note] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await waitForSyntheticEvent(page, note.id);

  const row = page
    .locator('.event-row')
    .filter({ hasText: 'wide custom emoji' });
  const inline = row.locator('img.custom-emoji[alt=":wide:"]');
  await expect(inline).toBeVisible();
  await expect(page.getByText(':wide:')).toHaveCount(0);
  await expect(inline).toHaveJSProperty('complete', true);

  const inlineBox = await inline.boundingBox();
  const rowBox = await row.boundingBox();
  const cap = await inline.evaluate(
    (node) => parseFloat(getComputedStyle(node).fontSize) * 6,
  );
  expect(inlineBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(inlineBox!.width).toBeGreaterThan(inlineBox!.height);
  expect(inlineBox!.width).toBeLessThanOrEqual(cap + 1);
  expect(inlineBox!.x + inlineBox!.width).toBeLessThanOrEqual(
    rowBox!.x + rowBox!.width + 1,
  );

  await row.getByRole('button', { name: 'Emoji', exact: true }).click();
  const popover = page.getByRole('dialog', { name: 'Emoji palette' });
  const pickerButton = popover.locator('button[title=":wide:"]');
  const pickerImage = pickerButton.locator('img.custom-emoji');
  await expect(pickerImage).toBeVisible();

  const buttonBox = await pickerButton.boundingBox();
  const pickerBox = await pickerImage.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(pickerBox).not.toBeNull();
  expect(pickerBox!.width).toBeLessThanOrEqual(buttonBox!.width);
  expect(pickerBox!.height).toBeLessThanOrEqual(buttonBox!.height);
});
