// Rail visibility on a signed-in Home across cold opens, tab switches and a cut-short warm restore.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { smokePath } from './smoke-output.ts';
import { installExtension } from './smoke-visitors.mjs';

const RUNS = 3;
const HISTORY = 2001;

async function warmRecords(sign, pubkey) {
  const records = [];
  const newest = Math.floor(Date.now() / 1000) - 120;
  for (let i = 0; i < HISTORY; i++) {
    const event = await sign({
      pubkey,
      kind: 1,
      created_at: newest - i * 30,
      tags: [],
      content: `Warm rail fixture ${i}`,
    });
    const raw = JSON.stringify([
      1,
      event.id,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
      event.sig,
    ]);
    const receipt = `lkjstr-verified-1:${createHash('sha256').update(raw).digest('hex')}`;
    records.push({ id: event.id, created_at: event.created_at, kind: event.kind, raw, receipt });
  }
  return records;
}

const writeHistory = (page, records) =>
  page.evaluate(
    (history) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lkjstr-wasm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction('events', 'readwrite');
          const store = transaction.objectStore('events');
          for (const record of history) store.put(record);
          const count = store.count();
          transaction.oncomplete = () => {
            db.close();
            resolve(count.result);
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    records,
  );

async function checkRail(page, width, phase, measurements) {
  const feed = page.locator('.feed[data-kind="home"]:visible');
  const note = feed.locator('.list .note').first();
  // Capture the miss as a real layout observation as well as a test failure.
  const observed = await Promise.allSettled([
    note.waitFor({ state: 'visible', timeout: 12000 }),
    feed
      .locator('.time-rail:not([hidden]) .time-grip')
      .waitFor({ state: 'visible', timeout: 12000 }),
  ]);
  const result = await feed.evaluate((el) => {
    const rail = el.querySelector('.time-rail');
    const grip = rail?.querySelector('.time-grip').getBoundingClientRect();
    return {
      rail: rail?.getBoundingClientRect().width ?? 0,
      grip: grip?.height ?? 0,
      dated: el.querySelectorAll('.list .note').length,
      plain: rail?.classList.contains('plain') ?? false,
    };
  });
  const ok =
    observed.every((r) => r.status === 'fulfilled') &&
    result.dated > 0 &&
    result.grip === 32 &&
    result.rail === (width === 390 ? 16 : 56) &&
    (phase.startsWith('cold') || result.plain);
  measurements.push({ phase, width, ok, ...result });
}

async function runLoad({
  browser,
  base,
  relayUrl,
  pubkey,
  errors,
  width,
  records,
  run,
  measurements,
}) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    hasTouch: width === 390,
    isMobile: width === 390,
  });
  try {
    await installExtension(ctx, relayUrl, pubkey, errors);
    await ctx.addInitScript(
      ({ mobile }) => {
        if (location.protocol !== 'http:') return;
        const home = mobile ? 'home~news' : 'home';
        if (!localStorage.getItem('lkjstr:layout:main'))
          localStorage.setItem(
            'lkjstr:layout:main',
            JSON.stringify({
              type: 'pane',
              id: 'rail-visibility',
              tabs: [home, 'docs'],
              active: home,
            }),
          );
        if (!localStorage.getItem('lkjstr:layout:guest'))
          localStorage.setItem(
            'lkjstr:layout:guest',
            JSON.stringify({
              type: 'pane',
              id: 'rail-visitor',
              tabs: ['docs'],
              active: 'docs',
            }),
          );
      },
      { mobile: width === 390 },
    );
    await ctx.route('**/*', (route) =>
      route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
    );
    const page = await ctx.newPage();
    await page.goto(base);
    await page.locator('.acct.out').click({ timeout: 12000 });
    await page
      .locator('.view[data-kind="account"]:visible [data-f="extension"]')
      .click({ timeout: 12000 });
    const home = page.locator('.tab[data-view^="home"]');
    const docs = page.locator('.tab[data-view="docs"]');

    await checkRail(page, width, `cold ${run}`, measurements);
    await docs.click();
    await home.click();
    await checkRail(page, width, `cold tab switch ${run}`, measurements);

    const committed = await writeHistory(page, records);
    measurements.push({
      phase: `committed history ${run}`,
      width,
      committed,
      ok: committed >= HISTORY,
    });
    await page.reload();
    await checkRail(page, width, `warm reload ${run}`, measurements);
    await docs.click();
    await home.click();
    await checkRail(page, width, `warm tab switch ${run}`, measurements);
  } catch (error) {
    measurements.push({
      phase: `load ${run}`,
      width,
      ok: false,
      error: String(error).split('\n')[0],
    });
  } finally {
    await ctx.close();
  }
}

export async function warmRailChecks({ browser, base, relayUrl, pubkey, sign, errors, observe }) {
  const records = await warmRecords(sign, pubkey);
  const measurements = [];
  for (const width of [390, 1440])
    for (let run = 1; run <= RUNS; run++)
      await runLoad({ browser, base, relayUrl, pubkey, errors, width, records, run, measurements });
  await writeFile(smokePath('warm-rail-visibility.json'), JSON.stringify(measurements, null, 2));
  await observe(
    [390, 1440].map((width) => [
      `signed-in Home rail stays visible on cold, warm and tab revisits at ${width}px`,
      measurements.filter((m) => m.width === width).every((m) => m.ok),
    ]),
  );
}
