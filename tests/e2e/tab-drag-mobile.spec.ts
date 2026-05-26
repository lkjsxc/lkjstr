import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

test('long-press tab drag does not select label text', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile',
    'Coarse-pointer long-press scenario runs on the mobile project only',
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
  const tab = page
    .locator('.pane')
    .nth(1)
    .getByRole('button', { name: 'Settings', exact: true });
  const box = await tab.boundingBox();
  if (!box) throw new Error('missing tab box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(280);
  await page.mouse.move(x + 48, y, { steps: 6 });
  await page.mouse.up();
  const selection = await page.evaluate(
    () => window.getSelection()?.toString() ?? '',
  );
  expect(selection.trim()).toBe('');
});
