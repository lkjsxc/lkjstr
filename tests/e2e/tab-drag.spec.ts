import { expect, test, type Page } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

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
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
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

type DragPoint = { readonly x: number; readonly y: number };

async function dragPointer(
  page: Page,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  fromRatio: DragPoint,
  toRatio: DragPoint,
): Promise<void> {
  await page.mouse.move(
    from.x + from.width * fromRatio.x,
    from.y + from.height * fromRatio.y,
  );
  await page.mouse.down();
  await page.mouse.move(
    to.x + to.width * toRatio.x,
    to.y + to.height * toRatio.y,
    { steps: 12 },
  );
  await page.mouse.up();
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
