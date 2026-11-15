// Shared product checks: use real browser input and the ordinary Worker boundary.
import { mkdir } from 'node:fs/promises';
export const wishRoot = new URL('../../tmp/', import.meta.url).pathname;
export const view = (kind) => `.pane.cur .view[data-kind="${kind}"]:visible`;
export async function front(page, kind) {
  await page.locator(`.pane.cur .tab[data-view="${kind}"]`).click();
  await page.locator(view(kind)).waitFor();
}
export async function probe(page, query) {
  const id = `wish-${Date.now()}-${Math.random()}`;
  await page.evaluate(
    ({ id, query }) => {
      window.wish.send({ t: 'open', sub: id, query });
      window.wish.send({ t: 'window', sub: id, anchor: 'top', before: 0, after: 60 });
    },
    { id, query },
  );
  await page.waitForFunction(
    (id) => window.wish.messages.some((m) => m.t === 'rows' && m.sub === id),
    id,
  );
  const rows = await page.evaluate(
    (id) => window.wish.messages.findLast((m) => m.t === 'rows' && m.sub === id).rows,
    id,
  );
  await page.evaluate((id) => window.wish.send({ t: 'close', sub: id }), id);
  return rows;
}
export async function slowly(page, field, text, check, name, update) {
  await field.fill('');
  const node = await field.elementHandle();
  let typed = '';
  for (const char of text) {
    typed += char;
    await field.pressSequentially(char);
    if (update) await update();
    await page.waitForTimeout(320);
    const value = await field.evaluate(
      (el, old) => ({
        same: el === old,
        value: el.value,
        caret: el.selectionStart,
        end: el.selectionEnd,
        focus: el === document.activeElement,
      }),
      node,
    );
    check(
      `${name}: ${typed.length} characters retain value, node and caret`,
      value.same &&
        value.value === typed &&
        value.caret === typed.length &&
        value.end === typed.length &&
        value.focus,
    );
  }
}
export async function seedWishes(ctx) {
  await ctx.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    const pane = (tabs) => ({ type: 'pane', id: 'wish-pane', tabs, active: tabs[0] });
    if (!localStorage.getItem('lkjstr:layout:main')) {
      localStorage.setItem(
        'lkjstr:layout:main',
        JSON.stringify(pane(['global', 'notifications', 'compose', 'home', 'account', 'settings'])),
      );
      localStorage.setItem('lkjstr:layout:guest', JSON.stringify(pane(['global', 'account'])));
      localStorage.setItem('lkjstr:settings', JSON.stringify({ theme: 'dark', language: 'en' }));
      localStorage.setItem('lkjstr:mock', JSON.stringify({ live: true }));
    }
    window.wish = { messages: [], sources: {}, windows: {}, send() {} };
    const observe = (port) => {
      const post = port.postMessage.bind(port);
      port.postMessage = (m, ...rest) => {
        if (m.t === 'open') window.wish.sources[m.sub] = m.query.source;
        if (m.t === 'window')
          window.wish.windows[m.sub] = { anchor: m.anchor, before: m.before, after: m.after };
        post(m, ...rest);
      };
      window.wish.send = (m) => post(m);
      port.addEventListener('message', ({ data }) => {
        if (['rows', 'patch', 'fresh', 'accounts', 'ready'].includes(data.t)) {
          window.wish.messages.push(data);
          if (window.wish.messages.length > 200) window.wish.messages.shift();
        }
      });
    };
    const Worker = window.Worker;
    window.Worker = class extends Worker {
      constructor(...args) {
        super(...args);
        observe(this);
      }
    };
    if (window.SharedWorker) {
      const Shared = window.SharedWorker;
      window.SharedWorker = class extends Shared {
        constructor(...args) {
          super(...args);
          observe(this.port);
        }
      };
    }
  });
}
export async function wishShot(page, item, engine, width) {
  if (process.env.LKJSTR_SHOTS !== '1') return;
  await mkdir(`${wishRoot}screens`, { recursive: true });
  await page.screenshot({ path: `${wishRoot}screens/wish-${item}-${engine}-${width}-dark.png` });
}

export async function wishFailure(page, engine, width, error) {
  await page.screenshot({ path: `${wishRoot}wish-failure-${engine}-${width}.png` });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    `${wishRoot}wish-failure-${engine}-${width}.txt`,
    await page.locator('body').innerText(),
  );
  writeFileSync(
    `${wishRoot}wish-state-${engine}-${width}.json`,
    JSON.stringify(
      await page.evaluate(() => ({
        lists: [...document.querySelectorAll('.view.feed')].map((el) => ({
          kind: el.dataset.kind,
          scroll: el.scrollTop,
          height: el.scrollHeight,
          rows: el.querySelector('.list').children.length,
          pill: el.querySelector('.fresh')?.textContent,
          hidden: el.querySelector('.fresh')?.hidden,
        })),
        sources: window.wish.sources,
        windows: window.wish.windows,
        messages: window.wish.messages
          .filter((m) => window.wish.sources[m.sub] === 'notifications')
          .map((m) =>
            m.t === 'fresh'
              ? m
              : {
                  t: m.t,
                  sub: m.sub,
                  rows: m.rows?.map((r) => ({ key: r.key, at: r.at, unread: r.unread })),
                  atTop: m.atTop,
                  atBottom: m.atBottom,
                },
          ),
      })),
      null,
      2,
    ),
  );
  throw error;
}
