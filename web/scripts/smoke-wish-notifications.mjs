import { front, view, wishShot } from './smoke-wish-support.mjs';
export async function wishNotifications({ page, real, events, width, fact, engine }) {
  await front(page, 'notifications');
  await page
    .locator(`${view('notifications')} .list > *`)
    .first()
    .waitFor();
  // The mock can fit all eight grouped rows on a tall desktop. This check
  // exercises scroll retention, so make overflow an explicit test precondition.
  await page.locator(view('notifications')).evaluate((el) => {
    if (el.scrollHeight <= el.clientHeight + 40) el.style.maxBlockSize = '560px';
  });
  await page.waitForFunction((selector) => {
    const el = document.querySelector(selector.replace(':visible', ''));
    return (
      el && el.querySelector('.list').children.length >= 8 && el.scrollHeight > el.clientHeight + 40
    );
  }, view('notifications'));
  await page.waitForFunction(() => {
    const sub = Object.keys(window.wish.sources).find(
      (key) => window.wish.sources[key] === 'notifications',
    );
    const rows = window.wish.messages.findLast((m) => m.t === 'rows' && m.sub === sub);
    return rows?.atBottom === true;
  });
  await page.waitForTimeout(250);
  await page.locator(view('notifications')).evaluate((el) => {
    el.scrollTop = Math.min(180, el.scrollHeight - el.clientHeight);
  });
  fact(
    '6 starts with a genuinely scrolled notification list',
    await page.locator(view('notifications')).evaluate((el) => el.scrollTop >= 39),
  );
  await page.waitForTimeout(200);
  const place = await page
    .locator(`${view('notifications')} .list > *`)
    .last()
    .evaluate((el) => ({ key: el.dataset.key, y: el.getBoundingClientRect().top }));
  if (real) await events({ kind: 'notifications', width });
  await page.locator(`${view('notifications')} .fresh:not([hidden])`).waitFor({ timeout: 20000 });
  fact(
    '6 grouped arrivals count once',
    (await page.locator(`${view('notifications')} .fresh`).innerText()).trim() === '1 new',
  );
  const hold = await page
    .locator(`${view('notifications')} [data-key="${place.key}"]`)
    .evaluate((el) => el.getBoundingClientRect().top);
  fact('6 arrivals hold the reading position', Math.abs(hold - place.y) <= 1);
  await wishShot(page, 6, engine, width);
  await page.locator(`${view('notifications')} .fresh`).click();
  await page.waitForTimeout(300);
  fact(
    '6 pill returns to top and clears',
    await page
      .locator(view('notifications'))
      .evaluate((el) => el.scrollTop < 8 && el.querySelector('.fresh').hidden),
  );

  if (width === 1440) {
    await page.locator(view('notifications')).evaluate((el) => {
      el.scrollTop = 180;
    });
    await page.waitForTimeout(200);
    const head = await page
      .locator(`${view('notifications')} .list > [data-key]:not([data-key^="day:"])`)
      .first()
      .getAttribute('data-key');
    if (real) {
      // This batch must sort above the held anchor. Same-second ids can instead
      // sort below it, where no new-row pill is expected.
      const latest = await page.evaluate(() => {
        const sub = Object.keys(window.wish.sources).find(
          (key) => window.wish.sources[key] === 'notifications',
        );
        return window.wish.messages.findLast((m) => m.t === 'rows' && m.sub === sub).rows[0].at;
      });
      await page.waitForFunction((at) => Date.now() >= at + 1000, latest);
      await events({ kind: 'notifications', width });
    }
    await page.locator(`${view('notifications')} .fresh:not([hidden])`).waitFor({ timeout: 20000 });
    await page.locator(view('notifications')).evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    fact(
      '6 scrolling to the top shows arrivals and clears the count without a press',
      await page
        .locator(view('notifications'))
        .evaluate(
          (el, key) =>
            el.scrollTop < 8 &&
            el.querySelector('.fresh').hidden &&
            el.querySelector('.list > [data-key]:not([data-key^="day:"])')?.dataset.key !== key,
          head,
        ),
    );
  }
}
