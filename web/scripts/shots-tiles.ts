// Maximize and collapse (docs/design.md, the frame): the tiles as they are, one maximized, and two collapsed (one
// upright in the row, one to its bar in the column). A phone has one tile, so it splits Home off below first.
import type { Page } from 'playwright-core';
import type { Scene } from './shots-emoji.ts';

export async function tilesShots(scene: Scene, width: number): Promise<void> {
  const phone = width < 760;
  const bar = (page: Page, tab: string) =>
    page.locator(`.pane:has(.tab[data-view="${tab}"]) > .strip`);
  const zoom = async (page: Page, tab: string, nth: number): Promise<void> => {
    await bar(page, tab).locator('.zoom').nth(nth).click();
  };
  /** On a phone, Home goes to a tile of its own under the rest. */
  const tiles = async (page: Page): Promise<void> => {
    if (!phone) return;
    await bar(page, 'home').locator(':scope > .icon').first().click();
    await page.locator('.menu button', { hasText: /^(Split down|下に分割)$/ }).click();
    await page.waitForSelector('.split.col');
  };
  await scene('tiles', '/', tiles);
  await scene('tiles-max', '/', async (page) => {
    await tiles(page);
    await zoom(page, 'home', 0);
    await page.waitForSelector('.pane.max');
  });
  await scene('tiles-fold', '/', async (page) => {
    await tiles(page);
    // Under 1200px Notifications shares the column with Post: Home folds in the row instead.
    if (phone) await zoom(page, 'global', 1);
    else
      await zoom(page, width < 1200 ? 'home' : 'notifications', 1), await zoom(page, 'compose', 1);
    await page.waitForSelector('.pane.min');
  });
}
