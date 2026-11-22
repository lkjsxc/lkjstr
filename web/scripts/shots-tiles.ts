// Maximize and collapse (docs/design.md, the frame): the tiles as they are, one maximized, and two collapsed (one
// upright in the row, one to its bar in the column). A phone starts with Post collapsed under the reading tile.
import type { Page } from 'playwright-core';
import type { Scene } from './shots-emoji.ts';

export async function tilesShots(scene: Scene, width: number): Promise<void> {
  const phone = width < 760;
  // The reader's Home is `home` on a desk and `home~news` on a phone.
  const bar = (page: Page, tab: string) =>
    page.locator(`.pane:has(.tab[data-view^="${tab}"]) > .strip`).first();
  const zoom = async (page: Page, tab: string, nth: number): Promise<void> => {
    await bar(page, tab).locator('.zoom').nth(nth).click();
  };
  await scene('tiles', '/', async () => undefined);
  await scene('tiles-max', '/', async (page) => {
    await zoom(page, 'home', 0);
    await page.waitForSelector('.pane.max');
  });
  await scene('tiles-fold', '/', async (page) => {
    // Under 1200px Notifications shares the column with Post: Home folds in the row instead.
    if (!phone)
      await zoom(page, width < 1200 ? 'home' : 'notifications', 1), await zoom(page, 'compose', 1);
    await page.waitForSelector('.pane.min');
  });
}
