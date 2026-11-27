// Screenshot-only Ready replies from the actual page mock Worker; no product fault setting.
import type { Browser, Page } from 'playwright-core';
import { en } from '../src/shared/strings-en.ts';
import { ja } from '../src/shared/strings-ja.ts';
import { accountFailureSheet } from './shots-account-failure-sheet.ts';
import type { ShotWriter } from './shots-provenance.ts';

type Scene = (
  name: string,
  path: string,
  act: (page: Page) => Promise<void>,
  mock?: string,
) => Promise<void>;
const notes = '.view[data-kind="home"] .list > .note';
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
    const state = document.querySelector('.view[data-kind="home"] > .fstate');
    return state?.textContent === word;
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
        // The scroll extent is rounded; inspect the words, not fractional bottom padding.
        const text = document.createRange();
        text.selectNodeContents(node);
        const r = text.getBoundingClientRect();
        const view = node.parentElement!.getBoundingClientRect();
        return r.height > 0 && r.top >= view.top && r.bottom <= Math.min(view.bottom, innerHeight);
      })
    )
      return;
  }
  throw new Error('existing Home failure status did not remain in its viewport');
}
export function createAccountFailureShots(shot: ShotWriter) {
  const captures = new Map<string, string[]>();
  const remember = (tag: string, name: string): void => {
    captures.set(tag, [...(captures.get(tag) ?? []), name]);
  };
  return {
    async run(scene: Scene, lang: 'ja' | 'en', tag: string): Promise<void> {
      const words = lang === 'ja' ? ja : en;
      await scene('account-failure-populated', '/', async (page) => {
        await home(page);
        await page.locator(notes).first().waitFor();
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
          assert((await page.locator(notes).count()) === 0, 'guest Home starts empty');
          // Inactive tabs unmount their view; this empty Home owns only its status node.
          const retained = await state.elementHandle();
          if (!retained) throw new Error('guest Home status premise');
          try {
            await failAccounts(page, words['error.internal']);
            assert((await state.locator('button').count()) === 0, 'failure precedes Home Sign in');
            assert(
              await retained.evaluate((node) => node.isConnected),
              'guest failure retains its existing status node',
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
      for (const [tag, names] of captures)
        await accountFailureSheet(browser, out, tag, names, shot);
    },
  };
}
