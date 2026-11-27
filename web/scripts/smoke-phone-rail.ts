import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';

type Touch = 'touchStart' | 'touchMove' | 'touchEnd';
type Point = { x: number; y: number; id: number };
type WebKitInput = {
  send(
    method: 'Input.dispatchTouchEvent',
    params: { type: Touch; touchPoints: Point[] },
  ): Promise<void>;
};

// The pinned Playwright WebKit exposes native touch moves via its page proxy.
// Its public touchscreen only offers tap.
function touchInput(page: Page): WebKitInput {
  const { _connection: connection } = page as Page & {
    _connection: { toImpl(page: Page): { delegate: { _pageProxySession: WebKitInput } } };
  };
  return connection.toImpl(page).delegate._pageProxySession;
}

const home = '.view[data-kind="home"]';

export async function checkPhoneRail(page: Page) {
  const feed = page.locator(home);
  const rail = feed.locator('.time-rail:not(.plain):not([hidden])');
  const grip = rail.locator('.time-grip');
  const label = rail.locator('.scrub');
  await grip.waitFor();
  await label.waitFor({ state: 'hidden' });
  const box = await rail.boundingBox();
  assert.ok(box && box.width === 16);
  const target = rail.locator('.time-grip-target');
  assert.ok((await target.boundingBox())?.width === 44);
  assert.equal(await target.evaluate((el) => getComputedStyle(el).touchAction), 'none');
  const input = touchInput(page);
  const x = Math.round(box.x + box.width - 40);
  const outside = Math.round(box.x - 80);
  const send = (type: Touch, y: number, at: number) =>
    input.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [{ x: at, y: Math.round(y), id: 7 }],
    });
  const read = () =>
    feed.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const row = Array.from(el.querySelectorAll<HTMLElement>('.list > .note')).find(
        (n) => n.getBoundingClientRect().bottom > top + 1,
      );
      const grip = el.querySelector('.time-grip')!.getBoundingClientRect();
      return { key: row?.dataset.key, y: grip.top + grip.height / 2, pageY: window.scrollY };
    });

  const homePosition = await read();
  assert.ok(homePosition.key && homePosition.y < box.y + 25);
  for (const share of [0.5, 0.99, 0.01]) {
    const before = await read();
    const y: number = box.y + box.height * share;
    await send('touchStart', before.y, x);
    await rail.and(page.locator('.held.touch')).waitFor();
    for (const step of [0.25, 0.5, 0.75, 1]) {
      const moveX = Math.round(x + (outside - x) * step);
      const moveY = before.y + (y - before.y) * step;
      await send('touchMove', moveY, moveX);
    }
    await page.waitForFunction(
      ({ home, y }) => {
        const grip = document.querySelector(`${home} .time-grip`)!.getBoundingClientRect();
        return Math.abs(grip.top + grip.height / 2 - y) < 24;
      },
      { home, y },
    );
    await label.waitFor();
    await send('touchEnd', y, outside);
    await rail.and(page.locator('.held')).waitFor({ state: 'hidden' });
    await label.waitFor({ state: 'hidden' });
    const after = await read();
    assert.ok(after.key && after.key !== before.key && Math.abs(after.y - y) < 45);
    assert.equal(after.pageY, homePosition.pageY);
    if (share < 0.02) assert.equal(after.key, homePosition.key);
  }
}
