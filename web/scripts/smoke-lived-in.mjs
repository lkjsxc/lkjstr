// Exercise every documented time-rail view on a durable, signed-in archive.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { livedInArchive } from './smoke-lived-in-archive.mjs';
import { smokePath } from './smoke-output.ts';
import { commitRailHistory } from './smoke-rail-history.mjs';
import { createRealFixture } from './smoke-real-fixture.mjs';
import { installExtension } from './smoke-visitors.mjs';

const widths = [390, 1440];
const nameFor = (width) =>
  `all documented rails stay visible on lived-in reload and tab switch at ${width}px`;
export const livedInCheckNames = widths.map(nameFor);

async function supportedTabs() {
  const docs = await readFile(new URL('../../docs/time-rail.md', import.meta.url), 'utf8');
  const section = docs.split(/^## Supported tabs$/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = section.split('\n').filter((line) => line.startsWith('|'));
  const tabs = rows.slice(2).map((line) => {
    const match = /^\| `([\w~-]+)` \| (\S.*) \|$/.exec(line);
    if (!match) throw new Error(`Invalid supported-tab row: ${line}`);
    return match[1];
  });
  if (!tabs.includes('home') || new Set(tabs).size !== tabs.length)
    throw new Error('Supported tabs must list Home and unique tab ids');
  return tabs;
}

const tabState = (tab, { pubkey, peer, channel, relay }) => {
  const [kind, mode] = tab.split('~');
  switch (kind) {
    case 'home':
      return { filter: { news: mode === 'news' } };
    case 'their-home':
      return { pubkey: peer };
    case 'profile':
      return { pubkey, show: mode };
    case 'search':
      return { text: 'rail history' };
    case 'hashtag':
      return { tag: 'rail-history' };
    case 'channel':
      return { id: channel };
    case 'relay':
      return { relay };
    case 'message':
      return { participants: [peer] };
    default:
      return {};
  }
};

async function measure(page, tab, after, measurements) {
  const pane = page
    .locator('.pane.cur')
    .filter({ has: page.locator(`.tab.active[data-view="${tab}"]`) });
  const [kind] = tab.split('~');
  const view = pane.locator(`.view[data-kind="${kind}"]:visible`);
  const rail = view.locator('.time-rail:not([hidden])');
  await page.locator('.acct:not(.out) .av').waitFor({ timeout: 12000 });
  const visible = await rail.waitFor({ state: 'visible', timeout: 6000 }).then(
    () => true,
    () => false,
  );
  measurements.push({
    tab,
    after,
    visible,
    railWidth: visible ? ((await rail.boundingBox())?.width ?? 0) : 0,
    profileMode:
      kind === 'profile' && visible
        ? (await view.locator('.pkind.on').innerText({ timeout: 2000 })).trim().toLowerCase()
        : undefined,
    absence: visible
      ? undefined
      : await page.evaluate((kind) => {
          const pane = document.querySelector('.pane.cur');
          const view = pane?.querySelector(`.view[data-kind="${kind}"]`);
          const rail = view?.querySelector('.time-rail');
          return {
            activeTab: pane?.querySelector('.tab.active')?.dataset.view,
            mounted: Boolean(view),
            railMounted: Boolean(rail),
            railHidden: rail?.hidden,
            status: view?.querySelector('.fstate')?.textContent,
          };
        }, kind),
  });
}

async function visit(
  { browser, base, relayUrl, pubkey, peer, sign, errors, tabs, archive },
  width,
) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    hasTouch: width === 390,
    isMobile: width === 390,
    locale: 'en-US',
  });
  const measurements = [];
  let stored, error;
  try {
    const relay = `${relayUrl}/lived-in`;
    await ctx.exposeFunction('fixtureSign', sign);
    await installExtension(ctx, relay, pubkey, errors, async (operation, peer, data) => {
      const reply = await sign({ fixtureCrypto: { pubkey, operation, peer, data } });
      return reply.value;
    });
    const states = Object.fromEntries(
      tabs.map((tab) => [
        tab,
        tabState(tab, {
          pubkey,
          peer,
          channel: archive.channel,
          relay,
        }),
      ]),
    );
    await ctx.addInitScript(
      ({ tabs, states }) => {
        if (location.protocol !== 'http:' || localStorage.getItem('lkjstr:layout:main')) return;
        const pane = (id, tabs, active) => ({ type: 'pane', id, tabs, active });
        localStorage.setItem(
          'lkjstr:layout:guest',
          JSON.stringify(pane('guest', ['docs'], 'docs')),
        );
        localStorage.setItem(
          'lkjstr:layout:main',
          JSON.stringify(pane('lived', ['docs', ...tabs], 'home')),
        );
        for (const [tab, state] of Object.entries(states))
          localStorage.setItem(`lkjstr:view:main1:${tab}`, JSON.stringify(state));
      },
      { tabs, states },
    );
    await ctx.route('**/*', (route) =>
      route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
    );
    const page = await ctx.newPage();
    await page.goto(base);
    await page.locator('.acct.out').click({ timeout: 12000 });
    await page.locator('.view[data-kind="account"]:visible [data-f="extension"]').click();
    await page.locator('.acct:not(.out) .av').waitFor();
    await page.locator('.feed[data-kind="home"]:visible .note').first().waitFor({ timeout: 15000 });
    stored = await commitRailHistory(page, archive.records, archive);

    const select = async (tab) => {
      const target = page.locator(`.tab[data-view="${tab}"]`);
      await target.click({ position: { x: 8, y: 10 }, timeout: 12000 });
      await page.locator(`.tab.active[data-view="${tab}"]`).waitFor({ timeout: 6000 });
    };
    for (const tab of tabs) {
      await select(tab);
      if (tab === 'messages')
        await page
          .locator('.view[data-kind="messages"]:visible .fstate button')
          .click({ timeout: 6000 });
      await page.reload();
      await measure(page, tab, 'reload', measurements);
      await select('docs');
      await select(tab);
      await measure(page, tab, 'tab switch', measurements);
    }
  } catch (failure) {
    error = String(failure);
  } finally {
    await ctx.close();
  }
  const ok =
    !error &&
    stored?.committed >= archive.expected &&
    stored.evictionPrepared &&
    stored.removed &&
    stored.retained &&
    measurements.length === 2 * tabs.length &&
    measurements.every(
      ({ tab, visible, railWidth, profileMode }) =>
        visible &&
        railWidth === (width === 390 ? 16 : 56) &&
        (!tab.startsWith('profile~') || profileMode === tab.split('~')[1]),
    );
  return { width, ok, error, ...stored, measurements };
}

export async function livedInChecks(options) {
  const { sign, pubkey, peer, observe } = options;
  const tabs = await supportedTabs();
  const archive = await livedInArchive(sign, pubkey, peer);
  const captures = await Promise.all(
    widths.map((width) => visit({ ...options, tabs, archive }, width)),
  );
  await writeFile(
    smokePath('lived-in-rail.json'),
    JSON.stringify({ tabs, ...archive.shape, captures }, null, 2),
  );
  await observe(captures.map(({ width, ok }) => [nameFor(width), ok]));
}

if (import.meta.main) {
  const { relayUrl, fixture, fixtureSign: sign, server, close } = await createRealFixture();
  let browser;
  const errors = [];
  try {
    const base = await new Promise((resolve, reject) => {
      server.stdout.once('data', (data) => resolve(String(data).trim()));
      server.once('exit', (code) => reject(new Error(`server exited ${code}`)));
    });
    browser = await chromium.launch({
      executablePath:
        process.env.LKJSTR_CHROME ??
        `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
      args: ['--no-sandbox', '--disable-background-networking', '--ignore-certificate-errors'],
    });
    const { pubkey: peer } = await sign({ fixtureActor: true });
    const observe = (outcomes) => {
      const failures = outcomes.filter(([, ok]) => !ok).map(([name]) => name);
      if (failures.length || errors.length)
        throw new Error([...failures, ...errors, smokePath('lived-in-rail.json')].join('\n'));
    };
    await livedInChecks({
      browser,
      base,
      relayUrl,
      sign,
      pubkey: fixture.note.pubkey,
      peer,
      errors,
      observe,
    });
    console.log('ok lived-in rail');
  } finally {
    await browser?.close();
    await close();
  }
}
