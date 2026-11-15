import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean) => void;

/** Exercise native controls without relying on Chromium's platform-specific shadow controls. */
export async function prepareAudioCheck(
  page: Page,
  view: string,
  check: Check,
): Promise<{
  redrawn(): Promise<void>;
  restored(): Promise<void>;
}> {
  const sound = page.locator(`${view} .media audio`).first();
  await sound.waitFor({ state: 'attached' });
  const id = await sound.evaluate((a) => a.closest<HTMLElement>('[data-note]')?.dataset.note);
  if (!id) throw new Error('audio note id');
  const selector = `${view} [data-note="${id}"] .media audio`;
  await sound.evaluate(async (node) => {
    const a = node as HTMLAudioElement;
    a.muted = true;
    a.volume = 0.35;
    a.preload = 'metadata';
    a.load();
    if (a.readyState < 1)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('audio metadata deadline')), 5000);
        a.addEventListener(
          'loadedmetadata',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        a.addEventListener(
          'error',
          () => {
            clearTimeout(timer);
            reject(new Error('audio fixture failed'));
          },
          { once: true },
        );
      });
    a.playbackRate = 1.25;
    a.currentTime = Math.min(1, a.duration / 3);
    await a.play();
  });
  const handle = await sound.elementHandle();
  let at = 0;
  return {
    async redrawn() {
      check(
        'reader: inline audio keeps its playing element through a full redraw',
        await page.evaluate(
          (a) => a?.isConnected === true && !(a as HTMLAudioElement).paused,
          handle,
        ),
      );
      at = await page.locator(selector).evaluate((node) => {
        const a = node as HTMLAudioElement;
        a.pause();
        return a.currentTime;
      });
    },
    async restored() {
      await page.waitForFunction(
        ({ selector, at }) => {
          const a = document.querySelector<HTMLAudioElement>(selector);
          return a && a.readyState >= 1 && Math.abs(a.currentTime - at) < 0.05;
        },
        { selector: selector.replaceAll(':visible', ''), at },
      );
      check(
        'reader: inline audio seek and device preferences survive reload',
        await page.locator(selector).evaluate((node) => {
          const a = node as HTMLAudioElement;
          return a.paused && a.volume === 0.35 && a.muted && a.playbackRate === 1.25;
        }),
      );
    },
  };
}
