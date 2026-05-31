import { expect, test } from '@playwright/test';
import {
  installSyntheticRelay,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { assertNoHorizontalOverflow, syntheticNotes } from './layout-helpers';
import { openNewTabOption, pane } from './workspace-helpers';

const options = [
  'Welcome',
  'Home',
  'Global',
  'Relay Settings',
  'lkjstr Log',
  'Notifications',
  'Accounts',
  'Mine npub',
  'Tweet',
  'Profile Edit',
  'Settings',
  'Search',
  'Custom Request',
  'Stats',
  'Upload Settings',
] as const;

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`tabs avoid horizontal overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await assertNoHorizontalOverflow(page);
    for (const option of options) {
      await openNewTabOption(page, option);
      await assertNoHorizontalOverflow(page);
    }
  });
}

test('feed lists fill split tiles', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await page
    .locator('.new-tab')
    .getByRole('button', { name: 'Global', exact: true })
    .click();
  const heights = await page
    .locator('.event-list')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height > 120)).toBe(true);
});

test('tab drag area does not extend past the close button', async ({
  page,
}) => {
  await page.goto('/');
  const frame = page.locator('.tab-frame').first();
  const close = frame.locator('.tab-close');
  const gap = await frame.evaluate((tab) => {
    const button = tab.querySelector('.tab-close');
    if (!button) return Number.POSITIVE_INFINITY;
    return (
      tab.getBoundingClientRect().right - button.getBoundingClientRect().right
    );
  });
  await expect(close).toBeVisible();
  expect(gap).toBeLessThanOrEqual(1);
});

test('global event scroller fills the tile body', async ({ page }) => {
  const notes = syntheticNotes(40);
  await installSyntheticRelay(page, { events: notes });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await waitForSyntheticEvent(page, notes[0]!.id);
  await expect(page.getByText('layout fit note 0')).toBeVisible({
    timeout: 15_000,
  });
  const heights = await page
    .locator('.pane-body[data-active-tab="true"] .event-list')
    .evaluate((list) => {
      const scroller = list.querySelector('.event-list__scroller');
      return {
        list: list.getBoundingClientRect().height,
        scroller: scroller?.getBoundingClientRect().height ?? 0,
      };
    });
  expect(heights.scroller).toBeGreaterThanOrEqual(heights.list * 0.8 - 1);
});

test('form fields expose id or name attributes', async ({ page }) => {
  await page.goto('/');
  for (const option of ['Relay Settings', 'Accounts', 'Tweet', 'Settings']) {
    await openNewTabOption(page, option);
  }
  const missing = await page
    .locator('input, textarea, select')
    .evaluateAll(
      (fields) =>
        fields.filter(
          (field) => !field.getAttribute('id') && !field.getAttribute('name'),
        ).length,
    );
  expect(missing).toBe(0);
});
