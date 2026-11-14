import { navigateView, viewPath } from './browser-addresses.mjs';
// Reloaded history and explicit retry of completed lookups, with local relays.
import { fakeRelay } from './browser-relay.mjs';

export async function browserNavigationReview(browser, url, data, check) {
  const errors = [];
  async function isolated(fake, view, run) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    try {
      await context.routeWebSocket(/.*/, fake.route);
      await context.route('**/*', (r) => r.request().url().startsWith(url) ? r.continue() : r.abort());
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      await navigateView(page, url, view);
      await page.locator('.pane').first().waitFor();
      await run(page, () => page.locator('.pane.focused .body.shown'));
    } finally { await context.close(); }
  }
  await isolated(fakeRelay(), { kind: 'search', query: 'history-one' }, async (page, focused) => {
    const submit = async (query) => {
      await focused().locator('input[type=search]').fill(query);
      await focused().locator('input[type=search]').press('Enter');
      await page.waitForFunction((q) => new URLSearchParams(location.search).get('q') === q, query);
    };
    await submit('history-two');
    await submit('history-three');
    const position = await page.evaluate(() => history.state);
    if (!(position >= 2)) throw new Error('History test needs multiple positive positions');
    // Wait for the actual workspace transaction before reloading.
    let saved = false;
    for (let n = 0; n < 100 && !saved; n++) {
      saved = await page.evaluate(async () => {
        const db = await new Promise((ok) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
        const raw = await new Promise((ok) => { const r = db.transaction('kv').objectStore('kv').get('workspace'); r.onsuccess = () => ok(r.result); });
        db.close();
        const ws = JSON.parse(raw ?? '{}');
        return Object.values(ws.navigation?.histories ?? {}).some((h) => h.back.some((v) => v.query === 'history-two'));
      });
      if (!saved) await page.waitForTimeout(50);
    }
    if (!saved) throw new Error('Workspace history did not commit');
    await page.reload();
    await focused().locator('input[type=search]').waitFor();
    check('reload preserves the current browser history position', await page.evaluate(() => history.state) === position);
    for (const [distance, query] of [[-2, 'history-one'], [2, 'history-three']]) {
      await page.evaluate(distance => history.go(distance), distance);
      await page.waitForFunction(q => document.querySelector('.pane.focused .body.shown input[type=search]')?.value === q, query, { timeout: 3000 });
      check(`browser history.go(${distance}) restores full distance and URL`, new URL(page.url()).searchParams.get('q') === query);
    }
    for (const [direction, query] of [['back', 'history-two'], ['back', 'history-one'], ['forward', 'history-two'], ['forward', 'history-three']]) {
      await (direction === 'back' ? page.goBack() : page.goForward());
      await page.waitForFunction((q) => document.querySelector('.pane.focused .body.shown input[type=search]')?.value === q, query, { timeout: 3000 });
      check(`browser ${direction} after reload restores ${query} and its URL`, await page.evaluate((q) => new URLSearchParams(location.search).get('q') === q, query));
    }
  });
  const event = data.events.find((e) => e.id === data.root);
  for (const mode of ['search', 'thread']) {
    let available = false;
    const requests = [];
    const query = event.content;
    const fake = fakeRelay({ request: (ws, sub, filters) => {
      if (!filters.some((f) => mode === 'search' ? f.search === query : f.ids?.includes(event.id))) return false;
      if (requests.length >= 1000) throw new Error('Retry request bound exceeded');
      requests.push(sub);
      if (available) ws.send(JSON.stringify(['EVENT', sub, event]));
      ws.send(JSON.stringify(['EOSE', sub]));
      return true;
    } });
    const view = mode === 'search' ? { kind: 'search', query } : { kind: 'thread', id: event.id, relays: [] };
    await isolated(fake, view, async (page, focused) => {
      const empty = focused().locator(mode === 'search' ? '.search .empty' : '.thread .empty').filter({ hasText: mode === 'search' ? 'No matches on this device' : 'Note not found' });
      await empty.waitFor();
      const previous = new Set(requests);
      available = true;
      await empty.getByRole('button', { name: 'Try again', exact: true }).click();
      const arrived = await focused().locator(`.note[data-id="${event.id}"]`).first().waitFor({ timeout: 3000 }).then(() => true, () => false);
      check(`completed ${mode} retry sends a fresh REQ and discovers a later result`, arrived && requests.some((sub) => !previous.has(sub)));
    });
  }
  check('history reload and completed retries have no page errors', errors.length === 0, errors.join(' | '));
}
