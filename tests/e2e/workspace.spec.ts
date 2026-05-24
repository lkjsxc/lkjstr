import { expect, test } from '@playwright/test';
import { pane } from './workspace-helpers';

test('opens the workspace and creates split panes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Welcome' })).toBeVisible();
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('region', { name: 'New Tab' })).toBeVisible();
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split down' }).click();
  await expect(page.getByRole('region', { name: 'New Tab' })).toHaveCount(2);
});

test('opens account, notification, and tweet tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toHaveCount(0);
  await secondPane(page)
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Notifications' }),
  ).toBeVisible();
  await expect(
    secondPane(page).getByRole('tab', { name: 'Notifications', exact: true }),
  ).toBeVisible();
  await secondPane(page)
    .getByRole('button', { name: 'Tweet', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Tweet' })).toBeVisible();
});

test('pane actions stay left of a single-row tab strip', async ({ page }) => {
  await page.goto('/');
  const header = pane(page, 0).locator('.pane-head');
  await expect(
    header.getByRole('button', { name: 'Open new tab' }),
  ).toBeVisible();
  await expect(
    header.getByRole('button', { name: 'Open tile menu' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      header.evaluate((node) =>
        [...node.children].map((child) => child.className).join('|'),
      ),
    )
    .toContain('pane-actions|tab-strip');
  await expect
    .poll(() =>
      header.locator('.tab-strip').evaluate((node) => {
        const style = getComputedStyle(node);
        return `${style.flexWrap}:${style.overflowX}`;
      }),
    )
    .toBe('nowrap:auto');
});

test('persists layout after reload', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await expect(page.getByRole('region', { name: 'New Tab' })).toBeVisible();
  await expect.poll(() => persistedNewTabCount(page)).toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(page.getByRole('region', { name: 'New Tab' })).toBeVisible();
});

function secondPane(page: import('@playwright/test').Page) {
  return page.locator('.pane').nth(1);
}

async function persistedNewTabCount(
  page: import('@playwright/test').Page,
): Promise<number> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('lkjstr.workspaceSnapshot');
      const workspace = raw ? JSON.parse(raw) : undefined;
      return Object.values(workspace?.tabs ?? {}).filter(
        (tab) =>
          typeof tab === 'object' &&
          tab !== null &&
          'kind' in tab &&
          tab.kind === 'new-tab',
      ).length;
    } catch {
      return 0;
    }
  });
}
