import { expect, test, type Page } from '@playwright/test';

const options = [
  'Home',
  'Global',
  'Relay Settings',
  'Relay Logs',
  'Notifications',
  'Accounts',
  'Tweet',
  'Settings',
  'Cache',
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
      await page.getByRole('button', { name: 'Open new tab' }).first().click();
      await page
        .locator('.new-tab')
        .last()
        .getByRole('button', { name: option, exact: true })
        .click();
      await assertNoHorizontalOverflow(page);
    }
  });
}

test('feed lists fill split tiles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await page
    .locator('.new-tab')
    .getByRole('button', { name: 'Global' })
    .click();
  const heights = await page
    .locator('.event-list')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height > 120)).toBe(true);
});

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const doc = document.documentElement;
        const panes = [...document.querySelectorAll('.pane, .pane-body')];
        return [
          doc.scrollWidth <= doc.clientWidth + 1,
          ...panes.map((pane) => pane.scrollWidth <= pane.clientWidth + 1),
        ].every(Boolean);
      }),
    )
    .toBe(true);
}
