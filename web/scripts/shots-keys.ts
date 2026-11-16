// K1-K4 review states use only the mock Worker and a fresh browser context for every shot.
import type { Page } from 'playwright-core';
import { MOCK_PASSWORD } from '../src/engine/mock/vault.ts';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
const account = '.view[data-kind="account"]:visible';
const view = (page: Page) => page.locator(account).last();
async function choose(page: Page, password = MOCK_PASSWORD) {
  const form = view(page).locator('.kpassword');
  await form.locator('[data-f="password"]').fill(password);
  await form.locator('[data-f="password-again"]').fill(password);
  await form.locator('[type="submit"]').click();
}
async function protectedRow(page: Page, open: (page: Page) => Promise<void>, locked: boolean) {
  await open(page);
  await view(page).locator('[data-f="protect"]').first().click();
  await choose(page);
  await view(page).locator('.kpassword').waitFor({ state: 'detached' });
  await view(page).locator('.kbox .krow button').last().click();
  if (locked) {
    await view(page).locator('[data-f="lock"]').click();
    await view(page).locator('[data-f="unlock"]').waitFor();
  }
}
async function importStep(page: Page, open: (page: Page) => Promise<void>) {
  await open(page);
  await view(page).locator('[data-f="other"]').click();
  const field = view(page).locator('[name="lkjstr-key"]');
  await field.fill('ncryptsec1mock-review-ciphertext');
  await field.press('Enter');
  await view(page).locator('[data-f="password"]').waitFor();
}
export async function keysShots(
  scene: Scene,
  open: (page: Page) => Promise<void>,
  lang: 'ja' | 'en',
) {
  await scene('keys-import', '/', (page) => importStep(page, open));
  await scene('keys-import-busy', '/', async (page) => {
    await importStep(page, open);
    // Delay only this mock operation, so the real busy surface can be photographed.
    await page.evaluate(() => {
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, options) {
        const send = () => Reflect.apply(post, this, [message, options]);
        if (message?.t === 'act' && message.action?.a === 'account.importEncrypted')
          setTimeout(send, 5000);
        else send();
      };
    });
    await view(page).locator('[data-f="password"]').fill(MOCK_PASSWORD);
    await view(page).locator('.kpassword [type="submit"]').click();
    await view(page).locator('.kpassword[aria-busy="true"]').waitFor();
  });
  await scene('keys-import-wrong', '/', async (page) => {
    await importStep(page, open);
    await view(page).locator('[data-f="password"]').fill('wrong password');
    await view(page).locator('.kpassword [type="submit"]').click();
    await view(page).locator('.kpassword .error').waitFor();
  });
  await scene('keys-locked', '/', (page) => protectedRow(page, open, true));
  await scene('keys-unlocked', '/', (page) => protectedRow(page, open, false));
  for (const wrong of [false, true]) {
    await scene(wrong ? 'keys-unlock-wrong' : 'keys-unlock', '/', async (page) => {
      await protectedRow(page, open, true);
      await view(page).locator('[data-f="unlock"]').click();
      await view(page).locator('.kpassword').waitFor();
      if (wrong) {
        await view(page).locator('[data-f="password"]').fill('wrong password');
        await view(page).locator('.kpassword [type="submit"]').click();
        await view(page).locator('.kpassword .error').waitFor();
      }
    });
  }
  await scene('keys-topbar', '/', async (page) => {
    await protectedRow(page, open, true);
    await page.locator('.acct').click();
    await page.locator('.menu').waitFor();
  });
  await scene('keys-compose', '/', async (page) => {
    await protectedRow(page, open, true);
    await page.keyboard.press('n');
    await page
      .locator('.view[data-kind="compose"]:visible .ctext')
      .fill(lang === 'ja' ? '今日の作業メモ。 #lkjstr' : 'Notes from today. #lkjstr');
  });
  await scene('keys-backup', '/', async (page) => {
    await open(page);
    await view(page).locator('[data-f="backup"]').first().click();
  });
  await scene('keys-copy', '/', async (page) => {
    await open(page);
    await view(page).locator('[data-f="backup"]').first().click();
    await choose(page);
    await view(page).locator('[data-f="save-encrypted"]').waitFor();
  });
  await scene('keys-raw', '/', async (page) => {
    await open(page);
    await view(page).locator('[data-f="backup"]').first().click();
    await view(page).locator('[data-f="raw"]').click();
    await view(page).locator('[data-f="show"]:enabled').waitFor();
  });
  await scene('keys-backup-locked', '/', async (page) => {
    await protectedRow(page, open, true);
    await view(page).locator('[data-f="backup"]').click();
    await view(page).locator('.kbox').waitFor();
  });
  for (const mismatch of [false, true]) {
    await scene(mismatch ? 'keys-protect-mismatch' : 'keys-protect', '/', async (page) => {
      await open(page);
      await view(page).locator('[data-f="protect"]').first().click();
      if (mismatch) {
        await view(page).locator('[data-f="password"]').fill(MOCK_PASSWORD);
        await view(page).locator('[data-f="password-again"]').fill('different password');
        await view(page).locator('[data-f="password-again"]').press('Tab');
      }
    });
  }
  await scene('keys-protect-done', '/', async (page) => {
    await open(page);
    await view(page).locator('[data-f="protect"]').first().click();
    await choose(page);
    await view(page).locator('.kpassword').waitFor({ state: 'detached' });
  });
}
