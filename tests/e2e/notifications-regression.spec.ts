import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey } from '../../src/lib/protocol';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { selectStartupTab } from './workspace-helpers';

test('notifications do not auto-load older on initial settle', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const authorKey = generateSecretKey();
  const author = getPublicKey(authorKey);

  const now = Math.floor(Date.now() / 1000);
  // Old events are just outside the initial 7-day lookback, but inside the
  // first older-page cursor (oldestLoaded - 7 days).
  const oldCreatedAt = now - 8 * 24 * 60 * 60;
  const newCreatedAt = now - 1 * 24 * 60 * 60;

  const oldEvents = Array.from({ length: 5 }, (_, i) =>
    finalizeEvent(
      {
        created_at: oldCreatedAt + i,
        kind: 1,
        tags: [['p', active]],
        content: `old-notification-${i}`,
      },
      authorKey,
    ),
  );
  const newEvents = Array.from({ length: 5 }, (_, i) =>
    finalizeEvent(
      {
        created_at: newCreatedAt + i,
        kind: 1,
        tags: [['p', active]],
        content: `new-notification-${i}`,
      },
      authorKey,
    ),
  );

  await installSyntheticRelay(page, { events: [...newEvents, ...oldEvents] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await selectStartupTab(page, 'Notifications');

  // The list is newest-first, so the highest index is near the top initially.
  await expect(page.getByText('new-notification-4')).toBeVisible({
    timeout: 15_000,
  });

  await expect(page.getByText('old-notification-4')).not.toBeVisible();

  const initialReqCount = await page.evaluate((accountPubkey) => {
    let count = 0;
    for (const socket of (window.__syntheticSockets ?? []) as any[]) {
      for (const raw of socket.sent ?? []) {
        const msg = JSON.parse(raw);
        if (msg?.[0] !== 'REQ') continue;
        const filter = msg?.[2] ?? {};
        const kinds: number[] = Array.isArray(filter.kinds)
          ? filter.kinds
          : [];
        const p: string[] = Array.isArray(filter['#p'])
          ? filter['#p']
          : [];
        if (kinds.includes(1) && p.includes(accountPubkey)) count += 1;
      }
    }
    return count;
  }, active);

  // Give the runtime a moment to (incorrectly) auto-fill older pages.
  await page.waitForTimeout(1500);

  const afterSettleReqCount = await page.evaluate((accountPubkey) => {
    let count = 0;
    for (const socket of (window.__syntheticSockets ?? []) as any[]) {
      for (const raw of socket.sent ?? []) {
        const msg = JSON.parse(raw);
        if (msg?.[0] !== 'REQ') continue;
        const filter = msg?.[2] ?? {};
        const kinds: number[] = Array.isArray(filter.kinds)
          ? filter.kinds
          : [];
        const p: string[] = Array.isArray(filter['#p'])
          ? filter['#p']
          : [];
        if (kinds.includes(1) && p.includes(accountPubkey)) count += 1;
      }
    }
    return count;
  }, active);

  expect(afterSettleReqCount).toBe(initialReqCount);

  const scroller = page.locator('.notification-list-scroller').first();
  await scroller.hover();
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });

  // Some browsers/UI layouts also attach scroll ownership to the viewport;
  // poke it too to ensure the runtime sees scroll intent.
  const viewport = page.locator('.notification-list-scroll').first();
  await viewport.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });

  // Also trigger with wheel to ensure near-end observers update.
  await page.mouse.wheel(0, 2400);

  await expect(page.getByText('old-notification-4')).toBeVisible({
    timeout: 15_000,
  });
});

