// M1-M6 review states, with all private fixture data confined to the screenshot context.
import type { Page } from 'playwright-core';
import { privateScene } from './shots-dm-fixture.ts';

type Scene = (name: string, path: string, run: (page: Page) => Promise<void>) => Promise<void>;
export async function dmShots(
  scene: Scene,
  settings: (page: Page) => Promise<void>,
  lang: 'ja' | 'en',
) {
  const open = async (page: Page, state: string): Promise<void> => {
    await privateScene(page, state, lang);
    await page.keyboard.press('Alt+Shift+M');
    await page.locator('.view[data-kind="messages"]:visible > *').first().waitFor();
  };
  const conversation = async (page: Page, state: string, group = false): Promise<void> => {
    await open(page, state);
    await page
      .locator('.view[data-kind="messages"]:visible .list .chan')
      .nth(group ? 1 : 0)
      .click();
    await page.locator('.view[data-kind="message"]:visible .dm-compose').waitFor();
  };
  for (const state of [
    'list',
    'loading',
    'empty',
    'failed',
    'setup',
    'locked',
    'readonly',
    'ask',
    'refused',
  ])
    await scene(`dm-${state}`, '/', (page) => open(page, state));
  await scene('dm-find', '/', async (page) => {
    await open(page, 'list');
    await page.locator('.view[data-kind="messages"]:visible input').fill('Lena');
    await page.locator('.dm-directory .chan').first().waitFor();
  });
  for (const state of ['conversation', 'first', 'nobody', 'paging'])
    await scene(`dm-${state}`, '/', async (page) => {
      await conversation(page, state);
      if (state === 'paging')
        await page.locator('.view[data-kind="message"]:visible').evaluate((el) => {
          el.scrollTop = el.scrollHeight;
          el.dispatchEvent(new Event('scroll'));
        });
    });
  await scene('dm-group', '/', (page) => conversation(page, 'group', true));
  for (const state of ['pending', 'partial', 'send-refused', 'too-long'])
    await scene(`dm-${state}`, '/', async (page) => {
      await conversation(page, state);
      const view = page.locator('.view[data-kind="message"]:visible');
      await view
        .locator('textarea')
        .fill(
          state === 'too-long'
            ? 'あ'.repeat(5500)
            : lang === 'ja'
              ? '明日の朝、ここで続きを話しましょう。'
              : 'Let us continue here tomorrow morning.',
        );
      if (state !== 'too-long') {
        await view.locator('.cbar .btn').click();
        await view.locator('.dm-outbox-row').waitFor();
      }
    });
  for (const state of ['relays', 'relays-edit', 'relays-suggest'])
    await scene(`dm-${state}`, '/', async (page) => {
      await privateScene(page, state, lang);
      await settings(page);
      const view = page.locator('.view[data-kind="settings"]:visible');
      await view.locator('.ssearch input').fill('dmRelays');
      const entry = view.locator('[data-entry="dmRelays"]:visible');
      await entry.waitFor();
      await entry.scrollIntoViewIfNeeded();
      if (state === 'relays-edit') {
        await entry.locator('input').fill('wss://fourth-inbox.example');
        await entry.locator('form button').click();
      }
    });
  await scene('dm-mark', '/', async (page) => {
    await privateScene(page, 'list', lang);
    await page.locator('.acct .dm-dot').waitFor();
    await page.locator('.acct').click();
  });
}
