import type { Page } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';

export type DragPoint = { readonly x: number; readonly y: number };

export async function dragPointer(
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

export async function moveSettingsTabToSecondTile(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
  await secondPane(page)
    .getByRole('tab', { name: 'Settings', exact: true })
    .dragTo(firstPane(page).locator('.tab-frame').first());
}

export function firstPane(page: Page) {
  return page.locator('.pane').nth(0);
}

export function secondPane(page: Page) {
  return page.locator('.pane').nth(1);
}

export async function openWorkspaceWithSettingsTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openNewTabOption(page, 'Settings', 1);
}
