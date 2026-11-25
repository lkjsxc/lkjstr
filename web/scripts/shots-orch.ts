// Orchestration scenes, normal and Large; either fails on horizontal scrolling.
import type { Page } from 'playwright-core';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
type Launch = (word: string, kind: string) => (page: Page) => Promise<void>;

export async function orchShots(scene: Scene, launch: Launch, lang: 'ja' | 'en'): Promise<void> {
  const open = launch(lang === 'ja' ? 'オーケストレーション' : 'Orchestration', 'orchestration');
  for (const big of ['', '-large'])
    await scene(`orchestration${big}`, '/', async (page) => {
      await open(page);
      const view = page.locator('.view[data-kind="orchestration"]:visible');
      await view.locator('.oflow .orow').first().waitFor();
      if (big) await view.locator('[data-chip="large"]').click();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error('horizontal overflow');
    });
}
