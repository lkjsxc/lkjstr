import type { Page } from 'playwright-core';
import type { Scene } from './shots-emoji.ts';

export async function sendingShots(scene: Scene): Promise<void> {
  const composer = '.view[data-kind="compose"]:visible';
  const fixture = '{"live":false,"slow":{"when":"Fixture","sign":13500,"relays":1800}}';
  const exercise =
    (text: string, phase: string, extension = false) =>
    async (page: Page): Promise<void> => {
      await page.keyboard.press('n');
      const view = page.locator(composer);
      const field = view.locator('textarea');
      if (extension) {
        await view.locator('.cwho').click();
        const option = page.locator('.menu button').nth(1);
        const name = await option.innerText();
        await option.click();
        await view.locator('.cwho').filter({ hasText: name.trim() }).waitFor();
      }
      await field.fill(text);
      await view.locator('.btn.primary:visible').click();
      if (extension) {
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('.cdraft[data-phase=signing]')].some((el) =>
              /Waiting for the extension|拡張機能/.test(el.textContent ?? ''),
            ),
          undefined,
          { timeout: 12500 },
        );
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
  await scene(
    'send-extension',
    '/',
    exercise('Fixture note about today.', 'signing', true),
    fixture,
  );
}
