import { expect, test } from '@playwright/test';

test('root opens the workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Accounts' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'What this workspace is' }),
  ).toBeVisible();
  await expect(page.getByText('browser-first Nostr workspace')).toBeVisible();
  await expect(page).toHaveTitle('lkjstr');
});

test('startup places Welcome above main tabs', async ({ page }) => {
  await page.goto('/');
  const boxes = await page.locator('.pane').evaluateAll((panes) =>
    panes.map((pane) => {
      const rect = pane.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    }),
  );
  expect(boxes).toHaveLength(2);
  expect(boxes[0]!.bottom).toBeLessThanOrEqual(boxes[1]!.top + 2);
  expect(boxes[0]!.height / (boxes[0]!.height + boxes[1]!.height)).toBeCloseTo(
    0.4,
    1,
  );
});

test('root reload stays visible when browser storage is unavailable', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('localStorage denied');
      },
    });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('indexedDB denied');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  expect(await page.evaluate(() => document.body.clientHeight)).toBeGreaterThan(
    0,
  );
  await page.reload();
  await expect(page.locator('.workspace-shell')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  expect(errors).toHaveLength(0);
});
