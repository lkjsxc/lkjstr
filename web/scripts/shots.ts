// Mock captures: ../tmp/screens/<name>-<width>-<theme>-<lang>.png.
// node scripts/shots.ts [--only=<width>-<theme>-<lang>] [--scenes=home,thread]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { type Browser, chromium, type Page } from 'playwright-core';
import { browserTmp } from './browser-tmp.ts';
import { createAccountFailureShots } from './shots-account-failure.ts';
import { actsShots } from './shots-acts.ts';
import { dmShots } from './shots-dm.ts';
import { emojiShots } from './shots-emoji.ts';
import { emojiCollisionShots } from './shots-emoji-collision.ts';
import { emojiCustomShots } from './shots-emoji-custom.ts';
import { genericShots } from './shots-generic.ts';
import { keysShots } from './shots-keys.ts';
import { looksShots } from './shots-looks.ts';
import { profileEditShots } from './shots-profile-edit.ts';
import { createShotWriter } from './shots-provenance.ts';
import { quoteShots } from './shots-quote.ts';
import { openRelay } from './shots-relay.ts';
import { sendingShots } from './shots-sending.ts';
import { threadShots } from './shots-thread.ts';
import { tilesShots } from './shots-tiles.ts';

const here = new URL('..', import.meta.url).pathname;
process.env.TMPDIR = browserTmp(process.env.TMPDIR ?? `${here}../tmp/temp`);
process.env.XDG_CACHE_HOME ??= `${here}../tmp/cache`;
process.env.XDG_CONFIG_HOME ??= `${here}../tmp/config`;
process.env.XDG_DATA_HOME ??= `${here}../tmp/data`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const out = process.env.LKJSTR_SHOTS_DIR ?? `${here}../tmp/screens`;
const chrome =
  process.env.LKJSTR_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const scenes = process.argv
  .find((a) => a.startsWith('--scenes='))
  ?.slice(9)
  .split(',');
const failed: string[] = [];
const shot = createShotWriter(here);
const accountFailureShots = createAccountFailureShots(shot);
const SIZES = [
  [1440, 900],
  [1024, 768],
  [390, 844],
] as const;

mkdirSync(out, { recursive: true });
mkdirSync(`${here}../tmp/shots`, { recursive: true });
const server = spawn(
  process.execPath,
  [`${here}scripts/serve.ts`, '--port=0', '--test-relay=ws://127.0.0.1:1'],
  {
    stdio: 'pipe',
  },
);
let ownedBrowser: Browser | undefined;
try {
  const base = await new Promise<string>((done, fail) => {
    server.stdout?.once('data', (data) => done(String(data).trim()));
    server.once('error', fail);
    server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
  const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  ownedBrowser = browser;
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
            javaScriptEnabled: !name.startsWith('site-'),
            colorScheme: theme,
            locale: lang === 'ja' ? 'ja-JP' : 'en-US',
            // The phone emoji scenes are touched by a finger, as on a phone.
            ...(width < 500 && name.startsWith('emoji-') ? { hasTouch: true, isMobile: true } : {}),
          });
          await ctx.route('**/*', (route) =>
            route.request().url().startsWith(base)
              ? route.continue()
              : route.fulfill({ status: 204, body: '' }),
          );
          await ctx.routeWebSocket('**/*', (socket) => socket.close());
          await ctx.addInitScript((m) => localStorage.setItem('lkjstr:mock', m), mock);
          if (name.startsWith('looks-'))
            await ctx.addInitScript(() => {
              if (!localStorage.getItem('lkjstr:layout:main'))
                localStorage.setItem(
                  'lkjstr:layout:main',
                  JSON.stringify({
                    type: 'pane',
                    id: 'looks',
                    tabs: ['global', 'home', 'compose', 'account', 'notifications', 'settings'],
                    active: 'home',
                  }),
                );
            });
          const page = await ctx.newPage();
          page.setDefaultTimeout(10000);
          page.on('pageerror', (e) => failed.push(`${name}-${tag}: ${e.message}`));
          try {
            await page.goto(`${base}${path}`);
            await page.waitForSelector(name.startsWith('site-') ? 'article h1' : '.note');
            await act(page);
            await page.waitForTimeout(350); // pictures and fonts
            await shot.screenshot(page, {
              path: name.startsWith('site-')
                ? `${here}../tmp/shots/${name}-${width}-${lang}.png`
                : `${out}/${name}-${tag}.png`,
            });
            if ((name === 'tabsearch' || name.startsWith('looks-')) && lang === 'en')
              await shot.screenshot(page, { path: `${out}/${name}-${width}-${theme}.png` });
          } catch (e) {
            if (process.env.LKJSTR_SHOTS_DEBUG) console.error(e);
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
          await page.waitForSelector(`.view[data-kind="${kind}"]:visible > *:visible`);
        };
        if (theme === 'dark' && (width === 1440 || width === 390))
          for (const id of ['about', 'features', 'guide'])
            await scene(`site-${id}`, `/${lang}/${id}.html`, async (page) => {
              if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
                throw new Error('horizontal overflow');
            });
        await genericShots(scene);
        await looksShots(scene, lang === 'ja' ? '統計' : 'Stats', width < 500);
        await emojiShots(scene);
        await emojiCustomShots(scene);
        await emojiCollisionShots(scene);
        await keysShots(scene, launch(lang === 'ja' ? 'アカウント' : 'Accounts', 'account'), lang);
        await dmShots(scene, launch(lang === 'ja' ? '設定' : 'Settings', 'settings'), lang);
        await accountFailureShots.run(scene, lang, tag);
        await actsShots(
          scene,
          launch(lang === 'ja' ? '通知' : 'Notifications', 'notifications'),
          lang,
        );
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
              .locator(`.note:has(.text a[href="${url}"])`)
              .filter({
                hasText: name === 'two' ? 'Two pages.' : name === 'news' ? 'A page with' : '',
              })
              .first();
            await row.locator('.nhead time').click();
            await page
              .locator(name === 'failed' ? '.th-focus' : '.th-focus .link-card')
              .first()
              .waitFor();
          });
        }
        await scene('tabsearch', '/', async (page) => {
          await page.locator('.bar [data-tab-search]').click();
          await page.locator('.tsearch input').waitFor();
        });
        await scene('home', '/', async () => undefined);
        await tilesShots(scene, width);
        // The scroll time label (interface-time.md C1): a wheel on Home (the rail) and on Notifications (native).
        for (const [name, kind] of [
          ['time-label', 'home'],
          ['time-native', 'notifications'],
        ] as const)
          await scene(name, '/', async (page) => {
            // Notifications has a tile of its own on a desktop; a phone brings it to the front.
            if (kind === 'notifications' && width < 760)
              await page.keyboard.press('g'), await page.keyboard.press('n');
            const feed = page.locator(`.view[data-kind="${kind}"]:visible`).first();
            const box = await feed.boundingBox();
            if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, 1600);
            await feed.locator('.scrub:not([hidden])').waitFor({ timeout: 900 });
          });
        // The scrubber (C2, C3): marks with the hover line, and a drag held over the years with its grip. A phone's
        // Home mixes in notifications (a native list), so the phone holds a profile's rail instead.
        const railAt = width < 500 ? (['/p/aoi', 'profile'] as const) : (['/', 'home'] as const);
        for (const name of ['time-days', 'time-held'] as const)
          await scene(name, railAt[0], async (page) => {
            const rail = page.locator(`.view[data-kind="${railAt[1]}"]:visible .time-rail`).first();
            await rail.waitFor();
            const box = await rail.boundingBox();
            if (!box) return;
            await page.mouse.move(box.x + box.width - 8, box.y + box.height * 0.08);
            if (name === 'time-held') {
              await page.mouse.down();
              await page.mouse.move(box.x + box.width - 8, box.y + box.height * 0.6, { steps: 6 });
              await page.waitForTimeout(650); // long enough for a target still loading to say so
            }
            await rail.locator('.scrub:not([hidden])').waitFor({ timeout: 900 });
          });
        await scene('profile', '/p/aoi', (page) =>
          page.waitForSelector('.profile').then(() => undefined),
        );
        await profileEditShots(scene);
        await scene('thread', '/', async (page) => {
          await page.locator('.note:has(.ctx .clip) .text').first().click();
          await page.waitForSelector('.th-focus');
          // After the relays answered: the waiting look is the thread-wait scene.
          await page.waitForSelector('.view[data-kind="thread"] .tskel', { state: 'detached' });
        });
        await threadShots(scene);
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
          await page.waitForSelector('.epick .egroup[data-section="cat:0"] .ecell');
        });
        await quoteShots(scene, lang);
        if ((width === 1440 && theme === 'dark') || (width === 390 && theme === 'light'))
          await sendingShots(scene);
        await scene('media', '/', async (page) => {
          await page.locator('.mbox:not(.audio)').first().click();
          await page.waitForSelector(
            '.view[data-kind="media"] img, .view[data-kind="media"] video',
          );
        });
        await scene('settings', '/', launch(lang === 'ja' ? '設定' : 'Settings', 'settings'));
        const relays = launch(lang === 'ja' ? 'リレー' : 'Relays', 'relays');
        await scene('relays', '/', relays);
        await scene('relay', '/', async (page) => (await relays(page), await openRelay(page)));
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
          await page.waitForSelector('.kbox .kpassword');
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
  if (!failed.length) await accountFailureShots.sheet(browser, out);
} finally {
  try {
    await ownedBrowser?.close();
  } finally {
    if (server.pid && server.exitCode === null && server.signalCode === null) {
      const closed = new Promise<void>((done) => server.once('close', () => done()));
      server.kill();
      await closed;
    }
  }
}
if (failed.length) console.log(failed.join('\n')), process.exit(1);
console.log('ok shots');
