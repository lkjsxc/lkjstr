// Screenshots of the mock build for judging the look: ../tmp/screens/<name>-<width>-<theme>-<lang>.png.
// node scripts/shots.ts [--only=<width>-<theme>-<lang>]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const here = new URL('..', import.meta.url).pathname;
const out = `${here}../tmp/screens`;
const port = 18800 + Math.floor(Math.random() * 100);
const chrome =
  process.env.LKJSTR_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
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
        const ctx = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: 1,
          colorScheme: theme,
          locale: lang === 'ja' ? 'ja-JP' : 'en-US',
        });
        await ctx.addInitScript(() => localStorage.setItem('lkjstr:mock', '{"live":false}'));
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${port}/`);
        await page.waitForSelector('.note');
        await page.screenshot({ path: `${out}/home-${tag}.png` });
        await page.goto(`http://127.0.0.1:${port}/p/aoi`);
        await page.waitForSelector('.profile');
        await page.screenshot({ path: `${out}/profile-${tag}.png` });
        await ctx.close();
      }
} finally {
  await browser.close();
  server.kill();
}
console.log('ok shots');
