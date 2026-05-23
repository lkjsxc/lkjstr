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

test('notification actor and action row is compact and left aligned', async ({
  page,
}) => {
  const account = generateSecretKey();
  const actor = generateSecretKey();
  const mention = finalizeEvent(
    {
      created_at: now(),
      kind: 1,
      tags: [['p', getPublicKey(account)]],
      content: 'notification mention body',
    },
    actor,
  );
  await installSyntheticRelay(page, { events: [mention] });
  await page.goto('/');
  await addReadonlyAccount(page, getPublicKey(account));
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByText('mentioned you')).toBeVisible();

  const meta = page.locator('.notification-row__meta').first();
  await expect(meta).toBeVisible();
  expect(await leftAligned(meta)).toBe(true);
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
