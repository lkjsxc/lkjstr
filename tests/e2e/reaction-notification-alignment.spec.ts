import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import {
  addReadonlyAccount,
  installSyntheticRelay,
} from './timeline-relay-helpers';

test('expanded reaction actor rows are left aligned', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const panel = document.createElement('div');
    panel.className = 'reaction-summary__actors';
    panel.innerHTML =
      '<button type="button"><span class="avatar sm"></span>' +
      '<span>Actor Name</span></button>';
    document.body.append(panel);
  });

  const row = page.locator('.reaction-summary__actors button').first();
  await expect(row).toBeVisible();
  expect(await leftAligned(row)).toBe(true);
});

test('reaction notification dedupes actor around canonical source row', async ({
  page,
}) => {
  const account = generateSecretKey();
  const actor = generateSecretKey();
  const actorName = 'Reaction Actor';
  const target = finalizeEvent(
    {
      created_at: now() - 1,
      kind: 1,
      tags: [],
      content: 'target body',
    },
    account,
  );
  const reaction = finalizeEvent(
    {
      created_at: now(),
      kind: 7,
      tags: [
        ['p', getPublicKey(account)],
        ['e', target.id],
      ],
      content: '+',
    },
    actor,
  );
  const actorMetadata = finalizeEvent(
    {
      created_at: now() - 2,
      kind: 0,
      tags: [],
      content: JSON.stringify({ name: actorName }),
    },
    actor,
  );
  await installSyntheticRelay(page, {
    events: [actorMetadata, target, reaction],
  });
  await page.goto('/');
  await addReadonlyAccount(page, getPublicKey(account));
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByText('reacted to you')).toBeVisible();
  await expect(page.getByText('reacted with ❤️')).toBeVisible();
  await expect(page.getByText('liked')).toHaveCount(0);

  const row = page.locator('.notification-row').first();
  await expect(row.getByText(actorName, { exact: true })).toHaveCount(1);
  await expect(row.locator('.notification-row__actor')).toHaveCount(0);

  const meta = row.locator('.notification-row__meta');
  await expect(meta).toBeVisible();
  expect(await leftAligned(meta)).toBe(true);

  const eventRow = row.locator('.notification-row__event .event-row').first();
  await expect(eventRow).toBeVisible();
  await expect(eventRow).not.toHaveClass(/event-row--compact/u);
});

test('fallback notification keeps outer actor with target context', async ({
  page,
}) => {
  const account = generateSecretKey();
  const actor = generateSecretKey();
  const accountPubkey = getPublicKey(account);
  const actorPubkey = getPublicKey(actor);
  const target = finalizeEvent(
    {
      created_at: now() - 1,
      kind: 1,
      tags: [],
      content: 'fallback target body',
    },
    account,
  );
  await installSyntheticRelay(page, { events: [target] });
  await page.goto('/');
  await addReadonlyAccount(page, accountPubkey);
  await seedFallbackNotification(page, {
    accountPubkey,
    actorPubkey,
    sourceEventId: 'f'.repeat(64),
    target,
  });
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();

  const row = page.locator('.notification-row').first();
  await expect(
    row.getByText('Notification event unavailable. Showing target context.'),
  ).toBeVisible();
  await expect(row.locator('.notification-row__actor')).toBeVisible();
  const eventRow = row.locator('.notification-row__event .event-row').first();
  await expect(eventRow).toBeVisible();
  await expect(eventRow).not.toHaveClass(/event-row--compact/u);
});

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function seedFallbackNotification(
  page: Page,
  input: {
    accountPubkey: string;
    actorPubkey: string;
    sourceEventId: string;
    target: ReturnType<typeof finalizeEvent>;
  },
): Promise<void> {
  await page.evaluate(
    async ({ accountPubkey, actorPubkey, sourceEventId, target }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lkjstr');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(
            ['notifications', 'events'],
            'readwrite',
          );
          const createdAt = Number(target.created_at) + 1;
          transaction.objectStore('events').put({
            ...target,
            receivedAt: Date.now(),
            relayUrls: ['wss://synthetic.test'],
          });
          transaction.objectStore('notifications').put({
            id: `${accountPubkey}:${sourceEventId}:reaction`,
            accountPubkey,
            sourceEventId,
            actorPubkey,
            kind: 'reaction',
            createdAt,
            receivedAt: Date.now(),
            readAt: null,
            muted: false,
            hidden: false,
            targetEventId: target.id,
            relayUrls: ['wss://synthetic.test'],
          });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            const error = transaction.error;
            db.close();
            reject(error);
          };
        };
      });
    },
    input,
  );
}

async function leftAligned(locator: Locator): Promise<boolean> {
  return await locator.evaluate((node) => {
    const style = getComputedStyle(node);
    const first = node.firstElementChild?.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return (
      style.textAlign === 'left' &&
      style.justifyContent === 'flex-start' &&
      Boolean(first && first.left >= box.left - 1 && first.left < box.left + 8)
    );
  });
}
