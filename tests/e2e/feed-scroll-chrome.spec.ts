import { expect, test, type Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import {
  addReadonlyAccount,
  installSyntheticRelay,
} from './timeline-relay-helpers';
import { assertNoHorizontalOverflow, syntheticNotes } from './layout-helpers';
import { openNewTabOption, pane, selectStartupTab } from './workspace-helpers';

function now(): number {
  return Math.floor(Date.now() / 1000);
}

test('notification rows use a single separator', async ({ page }) => {
  const account = generateSecretKey();
  const actor = generateSecretKey();
  const target = finalizeEvent(
    {
      created_at: now() - 1,
      kind: 1,
      tags: [],
      content: 'separator target',
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
  await selectStartupTab(page, 'Notifications');
  await expect(page.getByText('reacted to you')).toBeVisible({
    timeout: 20_000,
  });

  const borders = await page.locator('.notification-row').evaluateAll((rows) =>
    rows.map((row) => {
      const eventRow = row.querySelector('.event-row');
      return {
        rowBorder: getComputedStyle(row).borderBottomWidth,
        eventBorder: eventRow
          ? getComputedStyle(eventRow).borderBottomWidth
          : '0px',
      };
    }),
  );
  expect(borders.length).toBeGreaterThan(0);
  for (const sample of borders) {
    expect(sample.rowBorder).not.toBe('0px');
    expect(sample.eventBorder).toBe('0px');
  }
});

test('event more menu clears the feed scrollbar track', async ({ page }) => {
  await installSyntheticRelay(page, { events: syntheticNotes(24) });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await expect(page.getByText('layout fit note 0')).toBeVisible();
  const clearance = await page
    .locator('.event-row .event-more')
    .first()
    .evaluate((menu) => {
      const viewport = menu.closest('.event-list__viewport');
      if (!viewport) return null;
      const trackRight = viewport.getBoundingClientRect().right;
      const menuRight = menu.getBoundingClientRect().right;
      return trackRight - menuRight;
    });
  expect(clearance).not.toBeNull();
  expect(clearance!).toBeGreaterThanOrEqual(4);
});

test('tab scroll roots keep notification-like edge spacing', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile overlay scrollbars do not expose the same frame spacing',
  );
  await installSyntheticRelay(page, { events: syntheticNotes(24) });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();
  await expectFrameGap(page, 'section[aria-label="Welcome"]');

  await pane(page, 0).getByRole('button', { name: 'Open new tab' }).click();
  await expectFrameGap(page, 'section.new-tab');

  await page
    .locator('section.new-tab')
    .getByRole('button', { name: 'lkjstr Log', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'lkjstr Log' })).toBeVisible();
  await expectFrameGap(page, 'section[aria-label="lkjstr Log"]');

  await pane(page, 0).getByRole('button', { name: 'Open new tab' }).click();
  await page
    .locator('section.new-tab')
    .getByRole('button', { name: 'Relay Settings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Relay Settings' }),
  ).toBeVisible();
  await expectFrameGap(page, 'section[aria-label="Relay Settings"]');

  await pane(page, 0).getByRole('button', { name: 'Open new tab' }).click();
  await page
    .locator('section.new-tab')
    .getByRole('button', { name: 'Global', exact: true })
    .click();
  await expect(page.getByText('layout fit note 0')).toBeVisible();
  await expectFrameGap(
    page,
    'section[aria-label="Global"] .event-list__viewport',
  );
});

test('scroll owners avoid horizontal overflow', async ({ page }) => {
  await installSyntheticRelay(page, { events: syntheticNotes(20) });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await openNewTabOption(page, 'Notifications');
  await assertNoHorizontalOverflow(page);
});

async function expectFrameGap(page: Page, selector: string): Promise<void> {
  const gap = await rightEdgeGap(page, selector);
  expect(gap).toBeGreaterThanOrEqual(8);
  expect(gap).toBeLessThanOrEqual(22);
}

async function rightEdgeGap(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const paneElement = element.closest('.pane');
      if (!paneElement) throw new Error('missing pane');
      const paneBox = paneElement.getBoundingClientRect();
      const elementBox = element.getBoundingClientRect();
      return paneBox.right - elementBox.right;
    });
}
