// Actual historical bundles, same origin/storage/cache, then the current bundle. Read-only fixture accounts.

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { SELF } from '../src/engine/mock/people.ts';
import { auditCsp, historicalCacheHit } from './audit-browser.ts';

let dist = 'dist';
const types = { js: 'text/javascript', css: 'text/css', html: 'text/html', svg: 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = `${dist}${path === '/' ? '/index.html' : path}`;
  if (path.includes('..') || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, {
    'Content-Type': types[file.split('.').at(-1)] || 'application/octet-stream',
    'Content-Security-Policy': auditCsp(),
    'Cache-Control': file.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.LKJSTR_CHROME ??
    `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ['--no-sandbox'],
});
const results = {};
try {
  for (const ref of ['af8c915e', 'dbd66e59'])
    for (const width of [1440, 390]) {
      dist = `tmp/history/${ref}/dist`;
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        locale: 'en-US',
        colorScheme: 'dark',
      });
      await ctx.addInitScript((pubkey) => {
        if (!localStorage.getItem('lkjstr:mock'))
          localStorage.setItem('lkjstr:mock', '{"live":false,"accounts":"none"}');
        window.nostr = { getPublicKey: async () => pubkey };
      }, SELF.author.pubkey);
      const page = await ctx.newPage();
      const tag = `${ref}-${width}`;
      const check = (name, ok) => {
        results[`${tag}-${name}`] = !!ok;
        if (!ok) throw new Error(`${tag}: ${name}`);
      };
      const launch = async (name) => {
        await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
        await page.keyboard.type(name);
        await page.locator('.ncard > b').getByText(name, { exact: true }).click();
      };
      try {
        await page.goto(base);
        await page.locator('.note').first().waitFor();
        await page.locator('.acct.out').click();
        await page.locator('[data-f="extension"]').click();
        await page.locator('.view[data-kind="home"] .note').first().waitFor();
        check('historical-signin', (await page.locator('.acct:not(.out)').count()) === 1);
        // Persist the untouched default by switching away and back (normal controller disposal).
        await page.keyboard.press('Alt+Shift+2');
        await page.keyboard.press('Alt+Shift+1');
        await page.waitForTimeout(550);
        if (ref === 'af8c915e' && width === 1440) {
          await page.locator('.tab[data-view="bookmarks"]').click();
          await page.locator('.tab[data-view="global"]').click();
        } else {
          await page.locator('.tab[data-view="global"]').click();
          await page.locator('.tab[data-view="home"]').click();
        }
        await page.waitForTimeout(550);
        const defaultState = await page.evaluate(() =>
          Object.fromEntries(Object.entries(localStorage)),
        );
        await launch(ref === 'af8c915e' ? 'About' : 'Docs');
        if (ref === 'af8c915e') await launch('Shortcuts');
        await launch('Settings');
        await page.getByLabel('Text size', { exact: true }).fill('18');
        await page.getByLabel('Text size', { exact: true }).press('Tab');
        await page.evaluate(() => localStorage.setItem('lkjstr:mock', '{"live":false}'));
        await page.waitForTimeout(550);
        // Keep the exact pre-upgrade state to prove the custom arrangement's IDs/sizes/other settings survive.
        const before = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('lkjstr:layout:main')),
        );
        check('historical-http-cache-hit', await historicalCacheHit(page));
        dist = 'dist';
        await page.reload();
        await page.locator('.view[data-kind="settings"]:visible').waitFor();
        check(
          'setting-retained',
          (await page.getByLabel('Text size', { exact: true }).inputValue()) === '18',
        );
        const after = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('lkjstr:layout:main')),
        );
        const structure = (n) =>
          n.type === 'pane'
            ? { id: n.id }
            : { id: n.id, sizes: n.sizes, children: n.children.map(structure) };
        check(
          'custom-arrangement-retained',
          JSON.stringify(structure(before)) === JSON.stringify(structure(after)),
        );
        check(
          'retired-tabs-repaired',
          !JSON.stringify(after).includes('"shortcuts"') &&
            !JSON.stringify(after).includes('"about"') &&
            JSON.stringify(after).includes('docs'),
        );
        check(
          'post-renamed',
          (await page.locator('.tab[data-view="compose"] > span').innerText()) === 'Post',
        );
        await page.reload();
        await page.locator('.view[data-kind="settings"]:visible').waitFor();
        check(
          'second-reload-stable',
          (await page.getByLabel('Text size', { exact: true }).inputValue()) === '18',
        );
        await mkdir('tmp/screens', { recursive: true });
        if (process.env.LKJSTR_SHOTS === '1')
          await page.screenshot({ path: `tmp/screens/audit-06-returning-${tag}-custom.png` });
        await ctx.storageState({ path: `tmp/history/${ref}/state-${width}.json` });
        // A second profile uses the old bundle's exact untouched default, on the same origin.
        const plain = await browser.newContext({
          viewport: { width, height: 900 },
          locale: 'en-US',
        });
        await plain.addInitScript((state) => {
          if (!localStorage.getItem('audit-seeded')) {
            for (const [k, v] of Object.entries(state)) localStorage.setItem(k, v);
            localStorage.setItem('lkjstr:mock', '{"live":false}');
            localStorage.setItem('audit-seeded', '1');
          }
        }, defaultState);
        const p = await plain.newPage();
        await p.goto(base);
        await p.locator('.note').first().waitFor();
        check(
          'old-default-upgraded',
          (await p.locator('.pane').count()) === (width === 390 ? 1 : 3) &&
            (await p.locator('.tab[data-view="settings"]').count()) === 1,
        );
        if (process.env.LKJSTR_SHOTS === '1')
          await p.screenshot({ path: `tmp/screens/audit-06-returning-${tag}-default.png` });
        await plain.close();
      } catch (e) {
        results[`${tag}-failure`] = e.message;
      } finally {
        await ctx.close();
      }
    }
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
await writeFile('tmp/audit-returning.json', JSON.stringify(results, null, 2));
const failed = Object.entries(results).filter(([, v]) => v !== true);
if (failed.length) {
  console.error(failed);
  process.exitCode = 1;
} else console.log(`ok audit-returning ${Object.keys(results).length}`);
