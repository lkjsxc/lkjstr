import { navigateView, viewPath } from './browser-addresses.mjs';
// Regression checks for mixed relay deadlines and real image request retries.
import { spawnSync } from 'node:child_process';
import { fakeRelay } from './browser-relay.mjs';

export async function browserFoundationReview(browser, url, check) {
  const fixture = spawnSync('cargo', ['run', '-q', '-p', 'lkjstr-protocol', '--example', 'design-fixtures'], { encoding: 'utf8' });
  if (fixture.status !== 0) throw new Error('foundation review fixtures failed');
  const data = JSON.parse(fixture.stdout);
  const errors = [];
  const healthy = fakeRelay();
  const silent = fakeRelay({ request: () => true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await context.routeWebSocket(/.*/, (ws) => {
    (ws.url() === 'wss://nos.lol/' ? healthy : silent).route(ws);
  });
  let imageRequests = 0;
  await context.route('**/*', (route) => {
    const target = route.request().url();
    if (target.startsWith(url)) return route.continue();
    if (target === 'https://retry.fixture.invalid/image.svg') {
      imageRequests += 1;
      if (imageRequests === 1) return route.abort();
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.clock.install();
    // Start with no cached/fixture events: the first deadline must see one
    // answered relay and silent peers on the same live Global want.
    await navigateView(page, url, { kind: 'global' });
    await page.locator('.pane.focused .body.shown .empty').filter({ hasText: /Loading · 1 of/ }).waitFor();
    await page.waitForTimeout(300);
    await page.clock.fastForward(13_000);
    await page.waitForTimeout(300);
    const first = data.events.find((e) => e.id === data.root);
    healthy.add(first);
    const row = page.locator(`.pane.focused .body.shown .note[data-id="${first.id}"]`).first();
    const arrives = await row.waitFor({ timeout: 3000 }).then(() => true, () => false);
    check('healthy live feed delivers new events after another relay times out', arrives);
    // A second deadline/replan and a later event guard against briefly keeping
    // a subscription only for the first replan following expiration.
    await page.clock.fastForward(13_000);
    await page.waitForTimeout(300);
    const second = data.events.find((e) => e.kind === 1 && e.id !== first.id);
    healthy.add(second);
    check('live feed remains subscribed across later deadlines and replans', await page.locator(`.pane.focused .body.shown .note[data-id="${second.id}"]`).first().waitFor({ timeout: 3000 }).then(() => true, () => false));
    await navigateView(page, url, { kind: 'image', url: 'https://retry.fixture.invalid/image.svg' });
    const imagePage = page.locator('.pane.focused .body.shown .image-page');
    await imagePage.locator('.error').waitFor();
    await imagePage.locator('.image-target').evaluate((img) => { window.failedImage = img; });
    await imagePage.getByRole('button', { name: 'Try again', exact: true }).click();
    const loaded = await page.waitForFunction(() => {
      const img = document.querySelector('.pane.focused .body.shown .image-target');
      return img && img !== window.failedImage && img.complete && img.naturalWidth > 0 && !img.hidden;
    }, null, { timeout: 3000 }).then(() => true, () => false);
    check('image retry replaces the failed element and sends a second successful request', loaded && imageRequests === 2);
    check('successful retry clears the image error and retry action', await imagePage.locator('.error, button').count() === 0);
    await page.clock.fastForward(13_000);
    check('loaded retry stays successful beyond the image deadline', await imagePage.locator('.error, button').count() === 0);

    // Use a public read-only session to exercise owned reaction presentation.
    // The only reaction has the root as an ancestor and the reply as target.
    const reply = data.events.find((e) => e.id === data.reaction_target);
    await page.evaluate(async ({ pubkey, events }) => {
      const db = await new Promise((ok, fail) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); r.onerror = fail; });
      await new Promise((ok, fail) => {
        const tx = db.transaction(['kv', 'events'], 'readwrite');
        tx.objectStore('kv').put(JSON.stringify({ accounts: [{ pubkey, signer: 'readonly' }], active: pubkey }), 'session');
        for (const event of events) tx.objectStore('events').put({ id: event.id, created_at: event.created_at, raw: JSON.stringify(event) });
        tx.oncomplete = ok; tx.onabort = fail;
      });
      db.close();
    }, { pubkey: data.ancestral_reaction.pubkey, events: [first, reply, data.ancestral_reaction, data.ancestral_repost] });
    healthy.add(reply);
    healthy.add(data.ancestral_reaction);
    healthy.add(data.ancestral_repost);
    await navigateView(page, url, { kind: 'global' });
    await page.reload();
    const ancestor = page.locator(`.pane.focused .body.shown .note[data-id="${data.root}"]`).first();
    const target = page.locator(`.pane.focused .body.shown .note[data-id="${data.reaction_target}"]`).first();
    await target.locator('.reactions button.on').waitFor();
    check('ancestor has no reaction chip or selected Like from a descendant reaction', await ancestor.locator('.reactions button, .actions button.on').count() === 0);
    check('actual reaction target keeps the owned chip and selected Like', await target.locator('.reactions button.on').count() === 1 && await target.locator('.actions button.on').count() === 1);
    check('repost rendering also follows the protocol target rather than ancestor tags', await page.locator(`.pane.focused .body.shown .note[data-id="${data.reaction_target}"] .reposted`).count() === 1 && await ancestor.locator('.reposted').count() === 0);
  } finally { await context.close(); }
  check('foundation review has no page errors', errors.length === 0, errors.join(' | '));
}
