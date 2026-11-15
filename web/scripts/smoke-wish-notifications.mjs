import { front, view, wishShot } from './smoke-wish-support.mjs';
export async function wishNotifications({ page, real, events, width, fact, engine }) {
  await front(page, 'notifications');
  await page
    .locator(`${view('notifications')} .list > *`)
    .first()
    .waitFor();
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
    if (real) await events({ kind: 'notifications', width });
    await page.locator(`${view('notifications')} .fresh:not([hidden])`).waitFor({ timeout: 20000 });
    await page.locator(view('notifications')).evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForFunction(() => {
      const el = document.querySelector('.view[data-kind="notifications"]');
      return el.scrollTop < 8 && el.querySelector('.fresh').hidden;
    });
    fact('6 reaching the top by scrolling clears arrivals', true);
  }
}
