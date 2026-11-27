import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';

/** Playwright's Linux WebKit has no iOS keyboard. Inject its viewport readings to cover the recovery path. */
export async function checkKeyboardRecovery(page: Page) {
  const field = page.locator('.launcher input');
  const meta = page.locator('meta[name="viewport"]');
  const original = await meta.getAttribute('content');
  const fixture = await page.evaluateHandle(() => {
    const port = window.visualViewport;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!port || !viewport) throw new Error('Viewport unavailable');
    const width = port.width;
    const height = port.height;
    let scale = 1;
    let covered = 0;
    Object.defineProperties(port, {
      width: { configurable: true, get: () => width / scale },
      height: { configurable: true, get: () => (height - covered) / scale },
      scale: { configurable: true, get: () => scale },
    });
    // Respond to the clamp the way iOS does, then deliver the new viewport reading.
    const observer = new MutationObserver(() => {
      if (scale > 1 && viewport.content.includes('maximum-scale=1')) {
        scale = 1;
        port.dispatchEvent(new Event('resize'));
      }
    });
    observer.observe(viewport, { attributeFilter: ['content'] });
    return {
      resize(nextScale: number, nextCovered: number) {
        scale = nextScale;
        covered = nextCovered;
        port.dispatchEvent(new Event('resize'));
      },
      dispose: () => observer.disconnect(),
    };
  });
  const resize = (scale: number, covered = 0) =>
    fixture.evaluate((f, [scale, covered]) => f.resize(scale, covered), [scale, covered] as const);
  const restored = () =>
    page.waitForFunction(
      (content) =>
        visualViewport?.scale === 1 &&
        document.querySelector('meta[name="viewport"]')?.getAttribute('content') === content,
      original,
      { timeout: 2000 },
    );

  await field.focus();
  await resize(1.25);
  await field.blur();
  await restored();

  await field.focus();
  await resize(1.25, 285);
  await page.waitForTimeout(150); // Allow the app to observe the stable open keyboard.
  assert.equal(await meta.getAttribute('content'), original);
  assert.equal(await page.evaluate(() => visualViewport?.scale), 1.25);
  await resize(1.25);
  await restored();
  assert.ok(await field.evaluate((el) => el === document.activeElement));
  await field.blur();

  await resize(1.5); // A reader who starts editing while already zoomed keeps their zoom.
  await field.focus();
  await field.blur();
  await page.waitForTimeout(150);
  assert.equal(await meta.getAttribute('content'), original);
  assert.equal(await page.evaluate(() => visualViewport?.scale), 1.5);

  await resize(1);
  await field.focus();
  await field.dispatchEvent('gesturestart', { bubbles: true });
  await resize(1.5);
  await field.blur();
  await page.waitForTimeout(150);
  assert.equal(await meta.getAttribute('content'), original);
  assert.equal(await page.evaluate(() => visualViewport?.scale), 1.5);
  await fixture.evaluate((f) => f.dispose());
  await fixture.dispose();
}
