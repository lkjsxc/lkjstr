// Screenshots of the mock build for judging the look: ../tmp/screens/<name>-<width>-<theme>-<lang>.png.
// Scenes: home, profile, thread, notifications, compose (with the emoji picker), media, settings, relays, accounts,
// and a visitor's first run and sign-in (nobody signed in).
// node scripts/shots.ts [--only=<width>-<theme>-<lang>] [--scenes=home,thread]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const here = new URL('..', import.meta.url).pathname;
const out = `${here}../tmp/screens`;
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
const server = spawn(process.execPath, [`${here}scripts/serve.ts`, '--port=0'], {
  stdio: 'pipe',
});
const base = await new Promise<string>((done, fail) => {
  server.stdout?.once('data', (data) => done(String(data).trim()));
  server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
});
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
try {
  for (const [width, height] of SIZES)
    for (const theme of ['light', 'dark'] as const)
      for (const lang of ['ja', 'en'] as const) {
        const tag = `${width}-${theme}-${lang}`;
        if (only && only !== tag) continue;
        // Every scene starts from a fresh page, so none shows what another left behind.
        const scene = async (
          name: string,
          path: string,
          act: (page: Page) => Promise<void>,
          mock = '{"live":false}',
        ) => {
          if (scenes && !scenes.includes(name)) return;
          const ctx = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
            colorScheme: theme,
            locale: lang === 'ja' ? 'ja-JP' : 'en-US',
          });
          await ctx.addInitScript((m) => localStorage.setItem('lkjstr:mock', m), mock);
          const page = await ctx.newPage();
          try {
            await page.goto(`${base}${path}`);
            await page.waitForSelector('.note');
            await act(page);
            await page.waitForTimeout(350); // pictures and fonts
            await page.screenshot({ path: `${out}/${name}-${tag}.png` });
            if (name === 'tabsearch' && lang === 'en')
              await page.screenshot({ path: `${out}/${name}-${width}-${theme}.png` });
          } catch (e) {
            failed.push(`${name}-${tag}: ${String(e).split('\n')[0]}`);
          }
          await ctx.close();
        };
        /** A view from the New tab page, as a reader would open it. */
        const launch = (word: string, kind: string) => async (page: Page) => {
          await page.keyboard.press('Alt+Shift+N');
          await page.keyboard.type(word);
          // View choices precede Docs pages that can share their title (Relays).
          await page.locator('.ncard > b').getByText(word, { exact: true }).first().click();
          await page.waitForSelector(`.view[data-kind="${kind}"] > *`);
        };
        for (const [name, url] of [
          ['news', 'https://news.example/picture'],
          ['plain', 'https://news.example/article'],
          ['x', 'https://x.com/aoi/status/123'],
          ['failed', 'https://unavailable.example/path'],
          ['ja', 'https://news.example/japanese'],
          ['two', 'https://news.example/picture'],
        ]) {
          await scene(`card-${name}`, '/', async (page) => {
            const row = page
              .locator(`.note:has(.link-card[href="${url}"])`)
              .filter({
                hasText: name === 'two' ? 'Two pages.' : name === 'news' ? 'A page with' : '',
              })
              .first();
            await row.locator('.nhead time').click();
            await page.locator('.th-focus .link-card').first().waitFor();
          });
        }
        await scene('tabsearch', '/', async (page) => {
          await page.locator('.bar [data-tab-search]').click();
          await page.locator('.tsearch input').waitFor();
        });
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
        await scene('stats', '/', launch(lang === 'ja' ? '統計' : 'Stats', 'stats'));
        const channels = launch(lang === 'ja' ? 'チャンネル' : 'Channels', 'channels');
        await scene('channels', '/', async (page) => {
          await channels(page);
          // Beside the list at a width with tiles; in the same tile on a phone.
          await page
            .locator('.chan')
            .first()
            .click({ modifiers: width >= 760 ? ['Shift'] : [] });
          await page.waitForSelector('.view[data-kind="channel"] .note');
        });
        await scene('backup', '/', async (page) => {
          await launch(lang === 'ja' ? 'アカウント' : 'Accounts', 'account')(page);
          await page.locator('.view[data-kind="account"] [data-f="backup"]').first().click();
          await page.waitForSelector('.kbox .kfield');
        });
        await scene('accounts', '/', launch(lang === 'ja' ? 'アカウント' : 'Accounts', 'account'));
        const guest = '{"live":false,"accounts":"none"}';
        await scene('firstrun', '/', async () => undefined, guest);
        await scene(
          'signin',
          '/',
          async (page) => {
            await page.locator('.acct.out').click();
            await page.waitForSelector('.view[data-kind="account"] [data-f="extension"]');
          },
          guest,
        );
      }
} finally {
  await browser.close();
  server.kill();
}
if (failed.length) console.log(failed.join('\n')), process.exit(1);
console.log('ok shots');
