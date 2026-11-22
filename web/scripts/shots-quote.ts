// Quote in the Post tab (docs/design.md, Writing): Quote pressed on the first note of Home with a picture, the Post
// tab holding the quoted card and a few words; then the same draft with a content warning and its reason.
import type { Page } from 'playwright-core';
import type { Scene } from './shots-emoji.ts';

export async function quoteShots(scene: Scene, lang: 'ja' | 'en'): Promise<void> {
  const compose = '.view[data-kind="compose"]:visible';
  const quote = async (page: Page): Promise<void> => {
    const row = page.locator('.view[data-kind="home"]:visible .note:has(.mbox)').first();
    await row.locator('.acts > .a-repost').click();
    await page.getByRole('menuitem', { name: lang === 'ja' ? '引用' : 'Quote' }).click();
    await page.locator(`${compose} .cquote .qhead .name`).waitFor();
    await page
      .locator(`${compose} textarea`)
      .fill(lang === 'ja' ? '霧の朝、いい写真。' : 'A fine picture of a misty morning.');
  };
  await scene('quote', '/', quote);
  await scene('quote-cw', '/', async (page) => {
    await quote(page);
    await page.locator(`${compose} .cbar .icon:has(.i-warn)`).click();
    await page.locator(`${compose} .ccw`).fill(lang === 'ja' ? 'ネタバレ' : 'spoilers');
  });
}
