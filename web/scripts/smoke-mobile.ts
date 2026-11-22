// The phone and touch batch (owner, 2026-11-22), at 390 with a finger and at 1440 with a mouse: no field under 16px
// on a touch screen, so iOS never zooms into one; the top bar keeps the name and its right-hand buttons while the
// chips scroll with a fade; the phone default (Post collapsed at the bottom, notifications in Home, no Notifications
// tab), whose collapsed Post maximizes at once; and a picture that handles like a map, its percentage a handle.
import type { CDPSession, Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  given: Record<string, unknown>,
  size?: { width: number; height: number },
  touch?: boolean,
) => Promise<Page>;
type Pt = { x: number; y: number };

const PHONE = { width: 390, height: 844 };
const still = { mock: { live: false } };
const percent = async (page: Page): Promise<number> =>
  Number.parseFloat(await page.locator('.mscale').innerText());
const place = (page: Page): Promise<string> =>
  page.locator('.mstage img').evaluate((i) => (i as HTMLElement).style.transform);
const middle = async (page: Page, sel: string): Promise<Pt> => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Fingers on the screen, as the browser's own touch input: each step moves every finger to its next point. */
async function touch(cdp: CDPSession, paths: Pt[][], stepMs = 16): Promise<void> {
  const at = (i: number) => paths.map((p, id) => ({ ...(p[Math.min(i, p.length - 1)] as Pt), id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  const steps = Math.max(...paths.map((p) => p.length));
  for (let i = 1; i < steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i) });
    await new Promise((done) => setTimeout(done, stepMs));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const line = (from: Pt, to: Pt, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / n,
    y: from.y + ((to.y - from.y) * i) / n,
  }));
const near = (a: number, b: number, within: number): boolean => Math.abs(a / b - 1) <= within;

export async function mobileChecks(open: Open, check: Check): Promise<void> {
  const page = await open({ ...still, fresh: true }, PHONE, true);
  const cdp = await page.context().newCDPSession(page);

  // The top bar: the name, the chips scrolling between fades, the buttons at the right.
  const bar = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)?.getBoundingClientRect();
    const spaces = document.querySelector<HTMLElement>('lkjstr-spaces');
    return {
      name: box('.bar > .brand')?.width ?? 0,
      account: box('.bar > .acct')?.right ?? 0,
      search: box('.bar [data-tab-search]')?.right ?? 0,
      chips: spaces ? spaces.scrollWidth - spaces.clientWidth : 0,
      fade: spaces?.className ?? '',
      wide: document.documentElement.scrollWidth - innerWidth,
    };
  });
  await page.locator('lkjstr-spaces').evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
    el.dispatchEvent(new Event('scroll'));
  });
  const end = await page.locator('lkjstr-spaces').getAttribute('class');
  check(
    'phone bar: the name stays, the buttons stay at the right, the chips scroll with a fade',
    bar.name > 30 &&
      bar.account >= PHONE.width - 8 &&
      bar.search < bar.account &&
      bar.chips > 0 &&
      bar.fade.includes('more-r') &&
      end === 'more-l' &&
      bar.wide <= 0,
    [bar, end],
  );

  // The phone default: one tile over Post collapsed at the bottom; notifications in Home, no tab of their own.
  const panes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.pane')].map((p) => ({
      tabs: [...p.querySelectorAll<HTMLElement>('.tab')].map((t) => t.dataset.view).join(' '),
      min: p.classList.contains('min'),
      bottom: Math.round(p.getBoundingClientRect().bottom),
    })),
  );
  await page.locator('.view[data-kind="home"] .notif').first().waitFor();
  check(
    'phone default: Post collapsed at the bottom, notifications flowing into Home, no Notifications tab',
    panes.length === 2 &&
      panes[1]?.tabs === 'compose' &&
      panes[1].min &&
      panes[1].bottom === PHONE.height &&
      !panes.some((p) => p.tabs.includes('notifications')) &&
      (await page.locator('.tab.active').first().getAttribute('data-view')) === 'home~news' &&
      (await page.locator('.view[data-kind="home"] .rclear').isHidden()),
    panes,
  );
  const post = page.locator('.pane.min > .strip');
  const titles = await post
    .locator(':scope > button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title')).join('|'));
  await post.getByTitle(/^Maximize tile/).tap();
  await page.locator('.pane.max .view[data-kind="compose"] textarea').waitFor();
  check(
    'phone: the collapsed Post keeps the four buttons and maximizes at once',
    titles === 'Tile menu|Maximize tile (Alt+Shift+F)|Expand tile|New tab' &&
      (await page.locator('.pane').count()) === 1,
    titles,
  );

  // No field under 16px on a touch screen: iOS would zoom the page into it.
  await page.locator('.bar [data-tab-search]').tap();
  await page.locator('.tsearch input').waitFor();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable]')]
      .filter((e) => !['checkbox', 'radio', 'range'].includes((e as HTMLInputElement).type))
      .map((e) => [e.className || e.tagName, Number.parseFloat(getComputedStyle(e).fontSize)])
      .filter(([, size]) => (size as number) < 16),
  );
  const fields = await page.locator('input, textarea').count();
  check(
    'touch: no field is under 16px, so iOS does not zoom into it',
    !small.length && fields > 3,
    small,
  );
  await page.keyboard.press('Escape');
  await page.locator('.pane.max .zoom.on').tap();

  // A picture, with one finger and then two.
  await page.locator('.view[data-kind="home"] .mbox').first().tap();
  await page.locator('.mstage img').waitFor();
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('.mstage img')?.style.visibility === 'visible',
  );
  const fit = await percent(page);
  const handle = await middle(page, '.mscale');
  await touch(cdp, [line(handle, { x: handle.x + 100, y: handle.y })]);
  const twice = await percent(page);
  await touch(cdp, [line(handle, { x: handle.x - 200, y: handle.y })]);
  const less = await percent(page);
  check(
    'picture: one finger on the percentage slides the zoom, twice as close per 100px, and past the fit',
    near(twice / fit, 2, 0.15) && less < fit * 0.6,
    [fit, twice, less],
  );
  await page.locator('.mscale').tap();
  await page.waitForTimeout(400);
  check('picture: a press on the percentage fits it again', (await percent(page)) === fit, [
    fit,
    await percent(page),
  ]);
  const stage = await middle(page, '.mstage');
  const before = await place(page);
  await touch(cdp, [
    line({ x: stage.x - 40, y: stage.y }, { x: stage.x - 120, y: stage.y + 30 }),
    line({ x: stage.x + 40, y: stage.y }, { x: stage.x + 120, y: stage.y + 30 }),
  ]);
  await page.waitForTimeout(400);
  const pinched = await percent(page);
  check(
    'picture: two fingers pinch about where they are, and move it as they go',
    near(pinched / fit, 3, 0.2) && (await place(page)) !== before,
    [fit, pinched, before, await place(page)],
  );
  await touch(cdp, [line(stage, { x: stage.x - 160, y: stage.y - 40 }, 4)], 12);
  const released = await place(page);
  await page.waitForTimeout(200);
  const carried = await place(page);
  check(
    'picture: a release carries it on, slowing down, at the same scale',
    carried !== released && carried.split('scale')[1] === released.split('scale')[1],
    [released, carried],
  );
  await page.touchscreen.tap(stage.x, stage.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(stage.x, stage.y);
  await page.waitForTimeout(500);
  const whole = await percent(page);
  await page.touchscreen.tap(stage.x, stage.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(stage.x, stage.y);
  await page.waitForTimeout(500);
  check(
    'picture: a double tap goes back to the whole picture, and another goes closer',
    whole === fit && (await percent(page)) > fit,
    [fit, whole, await percent(page)],
  );
  await page.context().close();

  // With a mouse: a click leaves the picture as it is, a double click zooms about the pointer, the handle drags.
  const desk = await open(still, { width: 1440, height: 900 });
  await desk.locator('.view[data-kind="home"] .mbox').first().click();
  await desk.locator('.mstage img').waitFor();
  await desk.waitForFunction(
    () => document.querySelector<HTMLElement>('.mstage img')?.style.visibility === 'visible',
  );
  const deskFit = await percent(desk);
  const centre = await middle(desk, '.mstage');
  await desk.mouse.click(centre.x + 60, centre.y + 20);
  await desk.waitForTimeout(400);
  const clicked = await percent(desk);
  await desk.mouse.dblclick(centre.x + 60, centre.y + 20);
  await desk.waitForTimeout(400);
  const closer = await percent(desk);
  const grip = await middle(desk, '.mscale');
  await desk.mouse.move(grip.x, grip.y);
  await desk.mouse.down();
  await desk.mouse.move(grip.x, grip.y - 100, { steps: 8 });
  await desk.mouse.up();
  const dragged = await percent(desk);
  check(
    'picture: a click does nothing, a double click goes closer, the handle drags with the mouse',
    clicked === deskFit && closer > deskFit && near(dragged / closer, 2, 0.15),
    [deskFit, clicked, closer, dragged],
  );
  await desk.context().close();
}
