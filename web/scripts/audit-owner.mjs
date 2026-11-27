// Shared owner-facing browser checks, run by both mock and real-engine smokes.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SELF } from '../src/engine/mock/people.ts';
import { rebaseStorageState } from './audit-browser.ts';
import { auditExtra } from './audit-owner-extra.mjs';
import { auditReading } from './audit-owner-reading.mjs';
import { smokePath } from './smoke-output.ts';
import { bech32 } from './smoke-visitors.mjs';

const root = new URL('../../', import.meta.url).pathname;
export async function auditOwner({
  browser,
  base,
  real = false,
  prepare,
  check,
  returning,
  pubkey,
}) {
  const results = {};
  for (const width of [1440, 390]) {
    const storageState = returning
      ? rebaseStorageState(
          JSON.parse(await readFile(`${root}tmp/history/${returning}/state-${width}.json`, 'utf8')),
          base,
        )
      : undefined;
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      locale: 'en-US',
      colorScheme: 'dark',
      storageState,
    });
    await ctx.route('**/*', (r) =>
      r.request().url().startsWith(`${base}/`) ? r.continue() : r.abort(),
    );
    await ctx.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      if (!localStorage.getItem('lkjstr:settings'))
        localStorage.setItem('lkjstr:settings', '{"theme":"dark"}');
    });
    if (prepare) await prepare(ctx);
    else
      await ctx.addInitScript((pubkey) => {
        if (!localStorage.getItem('lkjstr:mock'))
          localStorage.setItem('lkjstr:mock', '{"live":false,"accounts":"none"}');
        window.nostr = { getPublicKey: async () => pubkey };
      }, SELF.author.pubkey);
    await ctx.route('https://example.test/cat.png', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#345"/></svg>',
      }),
    );
    const page = await ctx.newPage();
    page.setDefaultTimeout(12000);
    const prefix = `${returning ? `returning-${returning}` : real ? 'real' : 'mock'}-${width}`;
    const fact = async (n, name, ok = true) => {
      results[`${prefix}-${n}-${name}`] = ok ? 'ok' : 'FAIL';
      try {
        check(`audit ${prefix} ${n}: ${name}`, ok);
      } catch {
        /* record all independent items */
      }
      if (process.env.LKJSTR_SHOTS === '1') {
        await mkdir(smokePath('screens'), { recursive: true });
        await page.screenshot({
          path: smokePath(`screens/audit-${String(n).padStart(2, '0')}-${prefix}-${name}.png`),
        });
      }
    };
    const view = (kind) => page.locator(`.view[data-kind="${kind}"]:visible`).first();
    const find = async (word, kind) => {
      await page.waitForTimeout(250);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('o');
      await page.locator('.tsearch input').fill(word);
      await page.keyboard.press('Enter');
      await view(kind).waitFor();
    };
    try {
      await page.goto(base);
      if (storageState) {
        const settings = storageState.origins[0].localStorage.find(
          ({ name }) => name === 'lkjstr:settings',
        );
        await fact(
          6,
          'returning-settings-loaded',
          !!settings &&
            (await page.evaluate(
              () => JSON.parse(localStorage.getItem('lkjstr:settings')).textSize,
            )) === JSON.parse(settings.value).textSize,
        );
      }
      // The default has lkjsxc's Home where Global was; Global is opened like any tab.
      await find('Global', 'global');
      await view('global').locator('.note').first().waitFor();
      await fact(
        6,
        'visitor-layout',
        // A phone: one tile over Post collapsed at the bottom (owner, 2026-11-22).
        (returning || (await page.locator('.pane').count()) === (width === 390 ? 2 : 4)) &&
          (await page.locator('.tab').first().getAttribute('data-view')) !== 'write',
      );
      await find('Accounts', 'account');
      const account = view('account');
      const pair = account.locator('[data-f="extension"]');
      await fact(
        10,
        'calm-signin',
        (await pair.isVisible()) &&
          (await account.locator('[data-f="create"]').isVisible()) &&
          (await account.locator('input:visible').count()) === 0,
      );
      await pair.click();
      await page.locator('.acct:not(.out)').waitFor();
      await find('Accounts', 'account');
      await fact(
        36,
        'account-list-width',
        await view('account')
          .locator('.alist')
          .evaluate((e) => e.clientWidth >= e.closest('.view').clientWidth - 32),
      );
      await view('account').locator('.arow .avb').first().click();
      await view('profile').locator('.profile').waitFor();
      await fact(24, 'account-avatar-profile', true);
      await find('Home', 'home');
      await view('home').locator('.note').first().waitFor();
      await find('Post', 'compose');
      await fact(
        1,
        'post-name',
        (await page.locator('.tab.active[data-view^="compose"] > span').first().innerText()) ===
          'Post' &&
          // The interface's own words; Documentation's prose may use the verb ("Write in the Post tab").
          !(
            await page.evaluate(() => {
              const prose = [...document.querySelectorAll('.dpage')];
              for (const p of prose) p.style.display = 'none';
              const text = document.body.innerText;
              for (const p of prose) p.style.display = '';
              return text;
            })
          ).includes('Write'),
      );
      await page.keyboard.press('Escape');
      const before = await page.locator('.tab[data-view^="compose"]').count();
      await page.keyboard.press('n');
      await fact(
        13,
        'reuse-post',
        (await page.locator('.tab[data-view^="compose"]').count()) === before &&
          (await view('compose')
            .locator('textarea')
            .evaluate((e) => e === document.activeElement)),
      );
      const compose = view('compose');
      const message = `owner audit local fixture post ${width}`;
      await compose.locator('textarea').fill(message);
      const cleared = await compose.evaluate((el) => {
        el.querySelector('.cbar > .primary').click();
        return el.querySelector('textarea').value === '';
      });
      await compose.locator('textarea').fill('next draft while delivery continues');
      await fact(
        35,
        'ready-at-once',
        cleared &&
          (await compose.locator('.cbar > .primary').first().isEnabled()) &&
          (await compose.locator('.cresult').count()) > 0,
      );
      await find('Settings', 'settings');
      const settings = view('settings');
      await settings.getByLabel('Tab width', { exact: true }).fill('125');
      await settings.getByLabel('Tab width', { exact: true }).press('Tab');
      // One width for every tab of a bar; on a phone a full bar narrows its own tabs alike.
      const bars = await page
        .locator('.tabrow')
        .evaluateAll((rows) =>
          rows.map((row) =>
            [...row.querySelectorAll('.tab')].map((e) => e.getBoundingClientRect().width),
          ),
        );
      await fact(
        21,
        'fixed-width',
        bars.every((sizes) => sizes.every((w) => w > 0 && Math.abs(w - sizes[0]) < 2)) &&
          bars.some((sizes) => sizes.length > 1),
      );
      await fact(
        32,
        'client-tag-switch',
        await settings
          .getByRole('checkbox', { name: 'Include lkjstr in my posts', exact: true })
          .isChecked(),
      );
      await settings
        .getByRole('checkbox', { name: 'Include lkjstr in my posts', exact: true })
        .uncheck();
      await settings
        .getByRole('checkbox', { name: 'Include lkjstr in my posts', exact: true })
        .check();
      if (real) {
        await settings.locator('.srow .avb').first().click();
        await view('profile').locator('.profile').waitFor();
        await fact(24, 'muted-avatar-profile', true);
        await find('Settings', 'settings');
      }
      await settings.locator('[data-entry="set.servers"]').scrollIntoViewIfNeeded();
      await fact(
        36,
        'settings-list-width',
        await settings
          .locator('.sbox')
          .first()
          .evaluate((e) => e.clientWidth >= e.parentElement.clientWidth - 32),
      );
      await fact(9, 'media-choices', (await settings.locator('.soffers button').count()) >= 2);
      await fact(
        33,
        'blossom-default',
        (await settings.locator('[data-entry="set.servers"]').innerText()).includes('blossom.band'),
      );
      await settings.evaluate((e) => {
        e.scrollTop = e.scrollHeight;
      });
      await fact(
        19,
        'settings-search-scrolls',
        await settings.evaluate(
          (e) =>
            e.querySelector('.ssearch').getBoundingClientRect().bottom <
            e.getBoundingClientRect().top,
        ),
      );
      await auditReading({
        page,
        find,
        fact,
        view,
        peopleToken: pubkey ? bech32('npub', pubkey) : SELF.author.npub,
        message,
      });
      await auditExtra({ page, find, fact, view, real, width });
      await find('Relays', 'relays');
      await view('relays').locator('.rrow').first().waitFor();
      await fact(
        20,
        'flat-relays',
        (await view('relays').locator('.rlist > .rrow').count()) > 0 &&
          (await view('relays').locator('.sgroup').count()) === 0,
      );
      await fact(
        5,
        'account-relays-first',
        !real ||
          (await view('relays').locator('.rrow .clip').first().getAttribute('title')).includes(
            '/owner',
          ),
      );
      await find('Stats', 'stats');
      await view('stats').locator('tbody tr').first().waitFor();
      await fact(11, 'stats-figures', (await view('stats').locator('.sval').count()) === 4);
      // The default's own Documentation tab may be in view too: read the one just opened, in the current tile.
      const docs = () => page.locator('.pane.cur .view[data-kind="docs"]:visible');
      await find('Privacy policy', 'docs');
      await fact(
        3,
        'legal-tabs',
        (await docs().locator('.ditem.on').getAttribute('data-page')) === 'privacy',
      );
      await find('Terms', 'docs');
      await fact(
        16,
        'docs-tree',
        (await docs().locator('.dgroup').count()) === 3 &&
          (await docs().locator('.ditem.on').getAttribute('data-page')) === 'terms',
      );
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('o');
      await page.locator('.tsearch input').fill('Global');
      await fact(7, 'tab-search', (await page.locator('.tsearch .titem.open').count()) > 0);
      await page.keyboard.press('Enter');
      await find('Documentation', 'docs');
      await page.evaluate(() => document.activeElement?.blur());
      const tabs = await page.locator('.tab').count();
      await page.keyboard.press('x');
      await fact(30, 'one-key-close', (await page.locator('.tab').count()) === tabs - 1);
      await find('Settings', 'settings');
      await view('settings').getByLabel('Language', { exact: true }).selectOption('ja');
      await page.waitForFunction(
        () => document.querySelector('.tab[data-view^="compose"] > span')?.textContent === '投稿',
      );
      await fact(
        1,
        'post-japanese',
        !(await page.locator('.tab').allTextContents()).some((t) => t.includes('書く')),
      );
    } catch (e) {
      results[`${prefix}-error`] = e.message;
      await mkdir(smokePath('screens'), { recursive: true });
      await page.screenshot({ path: smokePath(`screens/audit-failure-${prefix}.png`) });
      await writeFile(smokePath(`audit-dom-${prefix}.txt`), await page.locator('body').innerText());
      try {
        check(`audit ${prefix}: ${e.message.split('\n')[0]}`, false);
      } catch {
        /* continue the other size */
      }
    } finally {
      await ctx.close();
    }
  }
  await writeFile(
    smokePath(`audit-${returning ? `returning-${returning}` : real ? 'real' : 'mock'}.json`),
    JSON.stringify(results, null, 2),
  );
}
