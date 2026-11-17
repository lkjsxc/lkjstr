// Screenshot-only Ready replies from the actual page mock Worker; no product fault setting.
import type { Browser, Page } from 'playwright-core';
import { en } from '../src/shared/strings-en.ts';
import { ja } from '../src/shared/strings-ja.ts';
import { accountFailureSheet } from './shots-account-failure-sheet.ts';

type Scene = (
  name: string,
  path: string,
  act: (page: Page) => Promise<void>,
  mock?: string,
) => Promise<void>;
const notes = '.view[data-kind="home"] > .list > .note, .view[data-kind="global"] > .list > .note';
const assert = (ok: boolean, why: string): void => {
  if (!ok) throw new Error(why);
};
async function home(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await page.locator('.view[data-kind="home"]:visible').waitFor();
}
async function failAccounts(page: Page, text: string): Promise<void> {
  const workers = page.workers();
  assert(workers.length === 1, 'one actual page mock Worker');
  await workers[0]!.evaluate(() => {
    const scope = self as unknown as { postMessage(value: unknown): void };
    scope.postMessage({
      t: 'ready',
      version: 13,
      engine: 'mock',
      accountError: { code: 'internal' },
    });
  });
  await page.waitForFunction((word) => {
    const states = [
      ...document.querySelectorAll(
        '.view[data-kind="home"] > .fstate, .view[data-kind="global"] > .fstate',
      ),
    ];
    return states.length === 2 && states.every((node) => node.textContent === word);
  }, text);
}
async function showStatus(page: Page): Promise<void> {
  const status = page.locator('.view[data-kind="home"]:visible > .fstate');
  // Scrolling can request another cached page. The finite mock contains fewer than 800 rows.
  for (let attempt = 0; attempt < 12; attempt++) {
    await status.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    if (
      await status.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const view = node.parentElement!.getBoundingClientRect();
        return r.top >= view.top && r.bottom <= view.bottom;
      })
    )
      return;
  }
  throw new Error('existing Home failure status did not remain in its viewport');
}
export function createAccountFailureShots() {
  const captures = new Map<string, string[]>();
  const remember = (tag: string, name: string): void => {
    captures.set(tag, [...(captures.get(tag) ?? []), name]);
  };
  return {
    async run(scene: Scene, lang: 'ja' | 'en', tag: string): Promise<void> {
      const words = lang === 'ja' ? ja : en;
      await scene('account-failure-populated', '/', async (page) => {
        await home(page);
        await page.locator('.view[data-kind="home"] > .list > .note').first().waitFor();
        await page.keyboard.press('Alt+Shift+ArrowLeft');
        await page.locator('.view[data-kind="global"]:visible > .list > .note').first().waitFor();
        await home(page);
        const retained = await page.evaluateHandle(
          (selector) => [...document.querySelectorAll(selector)],
          notes,
        );
        try {
          assert(await retained.evaluate((rows) => rows.length > 0), 'populated feed premise');
          await failAccounts(page, words['error.internal']);
          assert(
            await retained.evaluate((rows) => rows.every((row) => row.isConnected)),
            'failure retains existing note nodes',
          );
          await showStatus(page);
          assert(
            await retained.evaluate((rows) => rows.every((row) => row.isConnected)),
            'review scroll retains existing note nodes',
          );
          remember(tag, 'account-failure-populated');
        } finally {
          await retained.dispose();
        }
      });
      await scene(
        'account-failure-guest',
        '/',
        async (page) => {
          await home(page);
          const state = page.locator('.view[data-kind="home"]:visible > .fstate');
          await state.getByRole('button', { name: words['bar.signedOut'], exact: true }).waitFor();
          assert(
            (await page.locator('.view[data-kind="home"] > .list > .note').count()) === 0,
            'guest Home starts empty',
          );
          const retained = await page.evaluateHandle(
            (selector) => [...document.querySelectorAll(selector)],
            notes,
          );
          try {
            assert(await retained.evaluate((rows) => rows.length > 0), 'guest Global note premise');
            await failAccounts(page, words['error.internal']);
            assert((await state.locator('button').count()) === 0, 'failure precedes Home Sign in');
            assert(
              await retained.evaluate((rows) => rows.every((row) => row.isConnected)),
              'guest failure retains Global note nodes',
            );
            await showStatus(page);
            remember(tag, 'account-failure-guest');
          } finally {
            await retained.dispose();
          }
        },
        '{"live":false,"accounts":"none"}',
      );
    },
    async sheet(browser: Browser, out: string): Promise<void> {
      for (const [tag, names] of captures) await accountFailureSheet(browser, out, tag, names);
    },
  };
}
