import { expect, test } from '@playwright/test';
import {
  firstPane,
  openWorkspaceWithSettingsTab,
  secondPane,
} from './tab-drag-helpers';

test('center drop preview stays below tab strip', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const pane = secondPane(page);
  const source = pane.getByRole('button', { name: 'Settings', exact: true });
  const stack = pane.locator('.pane-stack');
  const paneBox = await pane.boundingBox();
  const stackBox = await stack.boundingBox();
  const sourceBox = await source.boundingBox();
  if (!paneBox || !stackBox || !sourceBox)
    throw new Error('missing drag boxes');
  const minOverlayTop = stackBox.y - paneBox.y;
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(
    stackBox.x + stackBox.width * 0.5,
    stackBox.y + stackBox.height * 0.5,
    { steps: 10 },
  );
  const layer = pane.locator('.pane-drop-layer.active');
  await expect(layer).toHaveAttribute('data-drop-zone', 'center');
  const overlayTop = await layer.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el, '::after').top || '0'),
  );
  expect(overlayTop).toBeGreaterThanOrEqual(minOverlayTop - 4);
  await page.mouse.up();
});

test('body top edge shows top split preview below pane head', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const pane = secondPane(page);
  const source = pane.getByRole('button', { name: 'Settings', exact: true });
  const stack = pane.locator('.pane-stack');
  const stackBox = await stack.boundingBox();
  const headBox = await pane.locator('.pane-head').boundingBox();
  if (!stackBox || !headBox) throw new Error('missing drag boxes');
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(stackBox.x + stackBox.width * 0.5, stackBox.y + 12, {
    steps: 10,
  });
  const layer = pane.locator('.pane-drop-layer.active');
  await expect(layer).toHaveAttribute('data-drop-zone', 'top');
  const dropTop = await layer.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el, '::after').top || '0'),
  );
  expect(dropTop).toBeGreaterThanOrEqual(headBox.height - 4);
  await page.mouse.up();
});

test('pointer drag moves a tab into another tile with overlay feedback', async ({
  page,
}) => {
  await openWorkspaceWithSettingsTab(page);
  const source = secondPane(page).getByRole('button', {
    name: 'Settings',
    exact: true,
  });
  const target = firstPane(page).locator('.pane-stack');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('missing drag boxes');
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width * 0.5,
    targetBox.y + targetBox.height * 0.1,
    { steps: 12 },
  );
  await expect(
    firstPane(page).locator('.pane-drop-layer.active'),
  ).toBeVisible();
  await page.mouse.move(
    targetBox.x + targetBox.width * 0.5,
    targetBox.y + targetBox.height * 0.5,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
});

test('edge drop creates a persisted split', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const source = secondPane(page).getByRole('button', {
    name: 'Settings',
    exact: true,
  });
  const target = firstPane(page).locator('.pane-stack');
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('missing target box');
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(targetBox.x + 8, targetBox.y + targetBox.height * 0.5, {
    steps: 12,
  });
  await expect(
    firstPane(page).locator('.pane-drop-layer.active'),
  ).toHaveAttribute('data-drop-zone', 'left');
  await page.mouse.up();
  await expect(page.locator('.pane')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.pane')).toHaveCount(3);
  await expect(
    page.getByRole('tab', { name: 'Settings', exact: true }),
  ).toBeVisible();
});
