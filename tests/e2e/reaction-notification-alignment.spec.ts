import { expect, test, type Locator } from '@playwright/test';
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

test('notification actor and action row is left aligned', async ({
  page,
}) => {
  const account = generateSecretKey();
  const actor = generateSecretKey();
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
  await installSyntheticRelay(page, { events: [target, reaction] });
  await page.goto('/');
  await addReadonlyAccount(page, getPublicKey(account));
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByText('reacted to you')).toBeVisible();
  await expect(page.getByText('reacted with ❤️')).toBeVisible();
  await expect(page.getByText('liked')).toHaveCount(0);

  const meta = page.locator('.notification-row__meta').first();
  await expect(meta).toBeVisible();
  expect(await leftAligned(meta)).toBe(true);

  const eventRow = page.locator('.notification-row__event .event-row').first();
  await expect(eventRow).toBeVisible();
  await expect(eventRow).not.toHaveClass(/event-row--compact/u);
});

function now(): number {
  return Math.floor(Date.now() / 1000);
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
