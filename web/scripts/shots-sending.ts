import type { Page } from 'playwright-core';
import type { Scene } from './shots-emoji.ts';

export async function sendingShots(scene: Scene): Promise<void> {
  const composer = '.view[data-kind="compose"]:visible';
  const fixture = '{"live":false,"slow":{"when":"Fixture","sign":13500,"relays":1800}}';
  const exercise =
    (text: string, phase: string, extension = false, cancel = false) =>
    async (page: Page): Promise<void> => {
      await page.keyboard.press('n');
      const view = page.locator(composer);
      const field = view.locator('textarea');
      if (extension) {
        await page.evaluate(() => {
          (window as { nostr?: unknown }).nostr = {
            signEvent: (event: unknown) =>
              new Promise((resolve) => setTimeout(() => resolve(event), 13500)),
          };
        });
        await view.locator('.cwho').click();
        const option = page.locator('.menu button').nth(1);
        const name = await option.innerText();
        await option.click();
        await view.locator('.cwho').filter({ hasText: name.trim() }).waitFor();
      }
      await field.fill(text);
      await view.locator('.btn.primary:visible').click();
      if (extension) {
        const draft = view.locator('.cdraft[data-signer-wait="approval"]');
        await draft.waitFor();
        if (cancel) {
          await draft.locator('.signer-cancel').click();
          await view.locator('.cdraft[data-phase="failed"]').waitFor();
        }
      } else {
        await view.locator(`.csend[data-phase=${phase}]`).waitFor();
        if (phase === 'sent') {
          await view.locator('.csend[data-phase=sent][data-ok="2"]').waitFor();
        }
      }
    };
  await scene(
    'send-sending',
    '/',
    exercise('A short note about today.', 'sending'),
    '{"live":false,"slow":{"when":"short","sign":5,"relays":2200}}',
  );
  await scene('send-sent', '/', exercise('A short note about today.', 'sent'));
  await scene('send-retrying', '/', exercise('An unanswered note.', 'retrying'));
  await scene('send-refused', '/', exercise('Today all relays refuse this note.', 'refused'));
  await scene('send-waiting', '/', exercise('Fixture note about today.', 'signing', true), fixture);
  await scene(
    'send-cancelled',
    '/',
    exercise('Fixture note about today.', 'signing', true, true),
    fixture,
  );
  await scene('signin-waiting', '/', async (page) => {
    await page.evaluate(() => {
      (window as { nostr?: unknown }).nostr = {
        getPublicKey: () =>
          new Promise((resolve) => setTimeout(() => resolve('a'.repeat(64)), 20000)),
      };
    });
    await page.locator('.acct').click();
    await page
      .locator('.menu button')
      .filter({ hasText: /Accounts|アカウント/ })
      .click();
    const accounts = page.locator('.view[data-kind="account"]:visible');
    await accounts.locator('[data-f="extension"]').click();
    await accounts.locator('.signer-cancel').waitFor();
  });
}
