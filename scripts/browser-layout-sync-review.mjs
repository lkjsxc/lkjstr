// Same-origin layout moves and private navigation state, using fake relays only.
import { fakeRelay } from './browser-relay.mjs';
import { viewPath } from './browser-addresses.mjs';

export async function browserLayoutSyncReview(browser, url, check) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const errors = [];
  await context.routeWebSocket(/.*/, fakeRelay().route);
  await context.route('**/*', r => r.request().url().startsWith(url) ? r.continue() : r.abort());
  const fresh = async () => {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url);
    await page.locator('.pane').first().waitFor();
    return page;
  };
  try {
    const sender = await fresh();
    await sender.waitForTimeout(800);
    const receiver = await fresh();
    await sender.keyboard.press('Alt+Shift+3');
    await sender.locator('.pane.focused .tab.active').waitFor();
    const tab = await sender.locator('.pane.focused .tab.active').getAttribute('data-tab');
    await receiver.keyboard.press('Alt+Shift+2');
    await receiver.waitForTimeout(800);
    await sender.keyboard.press('Control+Alt+Shift+2');
    await receiver.locator(`.tab[data-tab="${tab}"]`).waitFor({ timeout: 4000 });
    check('cross-workspace move arrives in the other browser destination', true);
    await receiver.waitForTimeout(800);
    await receiver.reload();
    await receiver.locator('.pane').first().waitFor();
    // The selected desk is shared in IndexedDB; either page may save it last.
    await receiver.keyboard.press('Alt+Shift+2');
    await receiver.locator(`.tab[data-tab="${tab}"]`).waitFor();
    check('received destination survives whole-bank persistence and reload', true);
    await receiver.keyboard.press('Alt+Shift+3');
    check('received source no longer owns the moved tab', await receiver.locator(`.tab[data-tab="${tab}"]`).count() === 0);
    await sender.close();

    for (const view of [
      { kind: 'thread', id: 'a'.repeat(64), relays: ['wss://hint.example'] },
      { kind: 'compose', reply_to: 'b'.repeat(64) },
    ]) {
      await receiver.waitForTimeout(800);
      const expected = await receiver.evaluate(async ({ view, path }) => {
        const db = await new Promise(ok => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
        const raw = await new Promise(ok => { const r = db.transaction('kv').objectStore('kv').get('spaces'); r.onsuccess = () => ok(r.result); });
        const spaces = JSON.parse(raw), ws = spaces.desks[spaces.active];
        const panes = [];
        const walk = node => { if (node.tabs) panes.push(node); for (const child of node.children ?? []) walk(child); };
        walk(ws.root);
        const tab = panes.find(p => p.id === ws.focus).active;
        ws.tabs[tab] = view;
        ws.navigation.histories[tab] = { back: [{ kind: 'search', query: 'saved-before-detail' }], forward: [] };
        await new Promise((ok, fail) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(JSON.stringify(spaces), 'spaces'); tx.oncomplete = ok; tx.onabort = fail; });
        db.close();
        window.addEventListener('pagehide', e => e.stopImmediatePropagation(), { capture: true, once: true });
        history.replaceState(1, '', path);
        return { tab, count: Object.keys(ws.tabs).length };
      }, { view, path: viewPath(view) });
      await receiver.reload();
      await receiver.locator(`.tab.active[data-tab="${expected.tab}"]`).waitFor();
      check(`${view.kind} reload resumes the saved tab identity`, await receiver.locator('.tab').count() === expected.count);
      await receiver.waitForTimeout(800);
      const saved = await receiver.evaluate(() => JSON.parse(localStorage.getItem('lkjstr-layout-sync')));
      const restored = saved.flatMap(ws => Object.entries(ws.tabs)).find(([tab]) => tab === String(expected.tab))?.[1];
      check(`${view.kind} reload keeps private navigation context`, JSON.stringify(restored) === JSON.stringify(view));
      await receiver.keyboard.press('Alt+ArrowLeft');
      await receiver.locator('.pane.focused .body.shown input[type=search]').waitFor();
      check(`${view.kind} reload keeps per-tab Back history`, await receiver.locator('.pane.focused .body.shown input[type=search]').inputValue() === 'saved-before-detail');
    }
  } finally { await context.close(); }
  check('layout sync review has no page errors', errors.length === 0, errors.join(' | '));
}
