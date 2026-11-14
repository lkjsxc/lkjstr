// Screenshots of the mock build for judging the look: ../tmp/screens/<name>-<width>-<theme>-<lang>.png.
// Scenes: home, profile, thread, notifications, compose (with the emoji picker), media, settings, relays.
// node scripts/shots.ts [--only=<width>-<theme>-<lang>] [--scenes=home,thread]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const here = new URL('..', import.meta.url).pathname;
const out = `${here}../tmp/screens`;
const port = 18800 + Math.floor(Math.random() * 100);
const chrome =
  process.env.LKJSTR_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const scenes = process.argv
  .find((a) => a.startsWith('--scenes='))
  ?.slice(9)
  .split(',');
const failed: string[] = [];
const SIZES = [
  [1440, 900],
  [1024, 768],
  [390, 844],
] as const;

mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [`${here}scripts/serve.ts`, `--port=${port}`], {
  stdio: 'pipe',
});
await new Promise((r) => server.stdout?.once('data', r));
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
try {
  for (const [width, height] of SIZES)
    for (const theme of ['light', 'dark'] as const)
      for (const lang of ['ja', 'en'] as const) {
        const tag = `${width}-${theme}-${lang}`;
        if (only && only !== tag) continue;
        // Every scene starts from a fresh page, so none shows what another left behind.
        const scene = async (name: string, path: string, act: (page: Page) => Promise<void>) => {
          if (scenes && !scenes.includes(name)) return;
          const ctx = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
            colorScheme: theme,
            locale: lang === 'ja' ? 'ja-JP' : 'en-US',
          });
          await ctx.addInitScript(() => localStorage.setItem('lkjstr:mock', '{"live":false}'));
          const page = await ctx.newPage();
          try {
            await page.goto(`http://127.0.0.1:${port}${path}`);
            await page.waitForSelector('.note');
            await act(page);
            await page.waitForTimeout(350); // pictures and fonts
            await page.screenshot({ path: `${out}/${name}-${tag}.png` });
          } catch (e) {
            failed.push(`${name}-${tag}: ${String(e).split('\n')[0]}`);
          }
          await ctx.close();
        };
        /** A view from the New tab page, as a reader would open it. */
        const launch = (word: string, kind: string) => async (page: Page) => {
          await page.keyboard.press('Alt+Shift+N');
          await page.keyboard.type(word);
          await page.locator('.ncard > b').getByText(word, { exact: true }).click();
          await page.waitForSelector(`.view[data-kind="${kind}"] > *`);
        };
        await scene('home', '/', async () => undefined);
        await scene('profile', '/p/aoi', (page) =>
          page.waitForSelector('.profile').then(() => undefined),
        );
        await scene('thread', '/', async (page) => {
          await page.locator('.note:has(.ctx .clip) .text').first().click();
          await page.waitForSelector('.th-focus');
        });
        await scene('notifications', '/', async (page) => {
          await page.keyboard.press('g');
          await page.keyboard.press('n');
          await page.waitForSelector('.view[data-kind="notifications"] .list > *');
        });
        await scene('compose', '/', async (page) => {
          await page.keyboard.press('n');
          await page.keyboard.type(
            lang === 'ja' ? '今日の作業メモ。 #lkjstr' : 'Notes from today. #lkjstr',
          );
          await page
            .locator('.view[data-kind="compose"]:visible .icon:has(.i-smile)')
            .first()
            .click();
          await page.waitForSelector('.epick .ecell');
        });
        await scene('media', '/', async (page) => {
          await page.locator('.mbox:not(.audio)').first().click();
          await page.waitForSelector(
            '.view[data-kind="media"] img, .view[data-kind="media"] video',
          );
        });
        await scene('settings', '/', launch(lang === 'ja' ? '設定' : 'Settings', 'settings'));
        await scene('relays', '/', launch(lang === 'ja' ? 'リレー' : 'Relays', 'relays'));
      }
} finally {
  await browser.close();
  server.kill();
}
if (failed.length) console.log(failed.join('\n')), process.exit(1);
console.log('ok shots');
