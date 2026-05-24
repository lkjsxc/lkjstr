import { expect, test, type Page } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

test('drags a tab from one tile to another', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
});

test('persists a moved tab after reload', async ({ page }) => {
  await moveSettingsTabToSecondTile(page);
  await page.reload();
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
  await expect(
    secondPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
});

test('pointer drag reorders tabs inside one tile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
  const pane = secondPane(page);
  const source = pane.getByRole('button', {
    name: 'Settings',
    exact: true,
  });
  const sourceBox = await source.boundingBox();
  const firstTabBox = await pane.locator('.tab-frame').first().boundingBox();
  if (!sourceBox || !firstTabBox) throw new Error('missing reorder boxes');
  await dispatchPointer(page, source, 'pointerdown', sourceBox, 0.5, 0.5);
  await dispatchPointer(
    page,
    page.locator('body'),
    'pointermove',
    firstTabBox,
    0.1,
    0.5,
  );
  await dispatchPointer(
    page,
    page.locator('body'),
    'pointerup',
    firstTabBox,
    0.1,
    0.5,
  );
  await expect(pane.locator('.tab-frame').first()).toHaveAttribute(
    'aria-label',
    'Settings',
  );
});

test('pointer drag moves a tab into another tile with overlay feedback', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
  const source = secondPane(page).getByRole('button', {
    name: 'Settings',
    exact: true,
  });
  const target = firstPane(page).locator('.pane-stack');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('missing drag boxes');
  await dispatchPointer(page, source, 'pointerdown', sourceBox, 0.5, 0.5);
  await dispatchPointer(
    page,
    page.locator('body'),
    'pointermove',
    targetBox,
    0.5,
    0.1,
  );
  await expect(
    firstPane(page).locator('.pane-drop-layer.active'),
  ).toBeVisible();
  await dispatchPointer(
    page,
    page.locator('body'),
    'pointermove',
    targetBox,
    0.5,
    0.5,
  );
  await dispatchPointer(
    page,
    page.locator('body'),
    'pointerup',
    targetBox,
    0.5,
    0.5,
  );
  await expect(
    firstPane(page).getByRole('tab', { name: 'Settings', exact: true }),
  ).toHaveCount(1);
});

async function dispatchPointer(
  page: Page,
  locator: ReturnType<Page['locator']>,
  type: string,
  box: { x: number; y: number; width: number; height: number },
  xRatio: number,
  yRatio: number,
) {
  await locator.dispatchEvent(type, {
    bubbles: true,
    button: 0,
    clientX: box.x + box.width * xRatio,
    clientY: box.y + box.height * yRatio,
    pointerId: 7,
    pointerType: 'touch',
  });
}

async function moveSettingsTabToSecondTile(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
  await secondPane(page)
    .getByRole('tab', { name: 'Settings', exact: true })
    .dragTo(firstPane(page).locator('.tab-frame').first());
}

function firstPane(page: Page) {
  return page.locator('.pane').nth(0);
}

function secondPane(page: Page) {
  return page.locator('.pane').nth(1);
}
