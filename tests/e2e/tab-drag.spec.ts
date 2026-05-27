import { expect, test } from '@playwright/test';
import {
  dragPointer,
  firstPane,
  moveSettingsTabToSecondTile,
  openWorkspaceWithSettingsTab,
  secondPane,
} from './tab-drag-helpers';

test('drags a tab from one tile to another', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'HTML5 drag-and-drop is not reliable on the mobile project',
  );
  await moveSettingsTabToSecondTile(page);
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
});

test('persists a moved tab after reload', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'HTML5 drag-and-drop is not reliable on the mobile project',
  );
  await moveSettingsTabToSecondTile(page);
  await page.reload();
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
});

test('pointer drag reorders tabs inside one tile', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const pane = secondPane(page);
  const sourceFrame = pane.getByRole('tab', { name: 'Settings', exact: true });
  await sourceFrame.scrollIntoViewIfNeeded();
  const sourceBox = await sourceFrame.boundingBox();
  const firstTabBox = await pane.locator('.tab-frame').first().boundingBox();
  if (!sourceBox || !firstTabBox) throw new Error('missing reorder boxes');
  await dragPointer(
    page,
    sourceBox,
    firstTabBox,
    { x: 0.5, y: 0.5 },
    { x: 0.1, y: 0.5 },
  );
  await expect(pane.locator('.tab-frame').first()).toHaveAttribute(
    'aria-label',
    'Settings',
  );
});

test('tab strip drag does not activate pane edge split zones', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const pane = secondPane(page);
  const source = pane.getByRole('button', { name: 'Settings', exact: true });
  const sourceBox = await source.boundingBox();
  const paneBox = await pane.boundingBox();
  if (!sourceBox || !paneBox) throw new Error('missing drag boxes');
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(
    paneBox.x + paneBox.width * 0.02,
    sourceBox.y + sourceBox.height * 0.5,
    { steps: 8 },
  );
  await expect(pane.locator('.pane-drop-layer.active')).toHaveAttribute(
    'data-drop-zone',
    'center',
  );
  await page.mouse.up();
});

test('pane head chrome never activates edge split zones', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Mobile tab-strip layout needs a dedicated long-press drag scenario',
  );
  await openWorkspaceWithSettingsTab(page);
  const pane = secondPane(page);
  const source = pane.getByRole('button', { name: 'Settings', exact: true });
  const actions = pane.locator('.pane-actions');
  const sourceBox = await source.boundingBox();
  const actionsBox = await actions.boundingBox();
  if (!sourceBox || !actionsBox) throw new Error('missing drag boxes');
  await source.hover();
  await page.mouse.down();
  await page.mouse.move(
    actionsBox.x + actionsBox.width * 0.5,
    actionsBox.y + actionsBox.height * 0.5,
    { steps: 8 },
  );
  await expect(pane.locator('.pane-drop-layer.active')).toHaveAttribute(
    'data-drop-zone',
    'center',
  );
  await page.mouse.up();
});
