// Workspace identity/visibility regressions. Only local cache and fake sockets.
import { spawnSync } from 'node:child_process';

export async function browserWorkspaceReview(browser, url, check) {
  const fixture = spawnSync('cargo', ['run', '-q', '-p', 'lkjstr-protocol', '--example', 'design-fixtures'], { encoding: 'utf8' });
  if (fixture.status !== 0) throw new Error('workspace review fixtures failed');
  const data = JSON.parse(fixture.stdout);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const errors = [], clients = new Map();
  let requests = 0;
  const targets = [data.root, data.reaction_target];
  const outstanding = () => [...clients.values()].reduce((n, subs) => n + subs.size, 0);
  await context.routeWebSocket(/.*/, (ws) => {
    const subs = new Set();
    clients.set(ws, subs);
    ws.onClose(() => clients.delete(ws));
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === 'CLOSE') subs.delete(msg[1]);
      if (msg[0] !== 'REQ') return;
      if (msg.slice(2).some((f) => f.ids?.some((id) => targets.includes(id)))) {
        if (subs.size >= 100) throw new Error('reference test subscription bound');
        requests += 1;
        subs.add(msg[1]); // Deliberately unanswered, so EOSE cannot release it.
      } else ws.send(JSON.stringify(['EOSE', msg[1]]));
    });
  });
  await context.route('**/*', (r) => r.request().url().startsWith(url) ? r.continue() : r.abort());
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const poll = async (predicate) => {
    for (let i = 0; i < 50; i++) {
      if (predicate()) return true;
      await page.waitForTimeout(40);
    }
    return false;
  };
  try {
    await page.goto(url);
    await page.locator('.pane').first().waitFor();
    await page.keyboard.press('Alt+Enter');
    await page.locator('.pane.zoomed').waitFor();
    await page.keyboard.press('Alt+Shift+2');
    await page.waitForFunction(() => !document.querySelector('.desk.zooming') && document.querySelector('.pane'));
    check('workspace switch clears zoom and leaves destination tiles visible', await page.locator('.pane:visible').count() > 0);
    await page.keyboard.press('Alt+Enter');
    await page.locator('.pane.zoomed').waitFor();
    await page.locator('.pane.zoomed').getByRole('button', { name: 'Tile menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Close tile', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.desk.zooming'));
    check('closing a zoomed tile clears zoom and reveals surviving tiles', await page.locator('.pane:visible').count() > 0);

    // Seed only public signed references; their targets remain absent.
    await page.evaluate(async ({ events }) => {
      const db = await new Promise((ok, fail) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); r.onerror = fail; });
      await new Promise((ok, fail) => {
        const tx = db.transaction(['events', 'kv'], 'readwrite');
        for (const event of events) tx.objectStore('events').put({ id: event.id, created_at: event.created_at, raw: JSON.stringify(event) });
        tx.objectStore('kv').put(JSON.stringify({ theme: 'system', text: 16, compact: false, data_saver: true }), 'settings');
        tx.oncomplete = ok; tx.onabort = fail;
      });
      db.close();
    }, { events: [data.events.find((e) => e.kind === 1 && e.content.includes('nostr:')), data.ancestral_repost] });
    await page.keyboard.press('Alt+Shift+1');
    await page.waitForTimeout(700);
    await page.reload();
    const global = page.locator('.tab').filter({ hasText: /^Global$/ }).first();
    await global.click();
    const tab = await global.getAttribute('data-tab');
    const body = page.locator('.pane.focused .body.shown');
    const load = body.getByRole('button', { name: 'Data saver · load note', exact: true });
    await load.first().waitFor();
    check('data saver leaves missing quote and repost targets unrequested', outstanding() === 0 && await load.count() === 2);
    await load.first().click();
    await load.first().click();
    check('manual quote and repost loads register unanswered requests', await poll(() => outstanding() > 0));
    await page.locator('.pane.focused .tab').filter({ hasText: /^Settings$/ }).click();
    check('hiding the owning tab closes manual reference requests before their deadline', await poll(() => outstanding() === 0));
    const before = requests;
    await page.locator(`.tab[data-tab="${tab}"]`).click();
    check('showing the owning tab resumes its manual reference requests', await poll(() => outstanding() > 0 && requests > before));
    await page.locator('.pane[data-pane="11"] .tab.active').click();
    await page.keyboard.press('Alt+Enter');
    check('zooming another tile releases manual reference requests', await poll(() => outstanding() === 0));
    await page.keyboard.press('Alt+Enter');
    if (!await poll(() => outstanding() > 0)) throw new Error('unzoom did not resume reference requests');
    await page.setViewportSize({ width: 390, height: 844 });
    check('narrow mode releases manual references in an unfocused tile', await poll(() => outstanding() === 0));
  } finally { await context.close(); }
  check('workspace review has no page errors', errors.length === 0, errors.join(' | '));
}
