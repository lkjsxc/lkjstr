// Regression checks for the cutover review, using fresh contexts and fake relays.
import { fakeRelay, fixtures } from './browser-relay.mjs';
import { browserReview2 } from './browser-review-2.mjs';

async function workspace(page, views) {
  await page.evaluate(async (views) => {
    const db = await new Promise((ok, fail) => {
      const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); r.onerror = fail;
    });
    const tabs = Object.fromEntries(views.map((v, i) => [i + 10, v]));
    const ws = { root: { type: 'pane', id: 1, tabs: views.map((_, i) => i + 10), active: 10 }, tabs, focus: 1, next_id: 40 };
    await new Promise((ok, fail) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(JSON.stringify(ws), 'workspace');
      tx.oncomplete = ok; tx.onabort = fail;
    });
    db.close();
    history.replaceState(null, "", "/");
  }, views);
  await page.reload();
  await page.waitForSelector('.pane');
}

async function waitUntil(page, predicate) {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await page.waitForTimeout(50);
  }
  throw new Error('Fake relay did not receive the expected requests');
}

export async function browserReview(browser, url, root, check) {
  const data = await fixtures(root);
  const errors = [];
  async function isolated(fake, init, run) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      await context.routeWebSocket(/.*/, fake.route);
      await context.route('**/*', (r) => r.request().url().startsWith(url) ? r.continue() : r.abort());
      if (init) await context.addInitScript(init.fn, init.arg);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(url);
      await page.waitForSelector('.pane');
      try { await run(page); }
      catch (error) {
        const frame = error.stack?.split('\n').find((line) => line.includes('browser-review'));
        throw new Error(`${String(error).split('\n')[0]} ${frame?.trim() ?? ''}`);
      }
    } finally { await context.close(); }
  }

  for (const mode of ['open', 'write', 'abort']) {
    await isolated(fakeRelay(), { arg: mode, fn: (mode) => {
      if (mode === 'open') {
        IDBFactory.prototype.open = function () { throw new DOMException('storage disabled', 'SecurityError'); };
        return;
      }
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (this.name === 'kv' && String(key).startsWith('secret:') && mode === 'write') {
          throw new DOMException('write refused', 'QuotaExceededError');
        }
        const request = put.call(this, value, key);
        if (this.name === 'kv' && key === 'session' && mode === 'abort') {
          const tx = this.transaction;
          request.addEventListener('success', () => tx.abort());
        }
        return request;
      };
    } }, async (page) => {
      await page.click('.topbar .account');
      await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
      await page.getByRole('button', { name: 'Create a new key', exact: true }).click();
      await page.getByRole('status').filter({ hasText: mode === 'open' ? 'Account storage unavailable' : 'Account storage write failed' }).waitFor();
      check(`account creation rejects ${mode} failure`, await page.locator('.pane.focused .body.shown .accounts li').count() === 0);
      if (mode !== 'open') {
        const clean = await page.evaluate(async () => {
          const db = await new Promise((ok) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
          const keys = await new Promise((ok) => { const r = db.transaction('kv').objectStore('kv').getAllKeys(); r.onsuccess = () => ok(r.result); });
          db.close();
          return !keys.some((k) => k === 'session' || String(k).startsWith('secret:'));
        });
        check(`account ${mode} failure rolls back secret and session`, clean);
      }
    });
  }

  const deferred = [];
  const fake = fakeRelay({ request: (ws, sub, filters) => {
    if (filters.some((f) => f.ids?.includes(data.remote.id))) {
      if (deferred.length < 50) deferred.push([ws, sub]);
      return true;
    }
    return false;
  } });
  fake.add(data.repost);
  await isolated(fake, null, async (page) => {
    await workspace(page, [{ kind: 'global' }]);
    await page.locator('.note-missing:has-text("Looking for this note")').waitFor();
    await waitUntil(page, () => deferred.length >= 3);
    for (const [ws, sub] of deferred) ws.send(JSON.stringify(['EOSE', sub]));
    await page.locator('.note-missing:has-text("Note not found")').waitFor();
    check('missing repost lookup settles after EOSE', true);
    fake.add(data.remote);
    await page.locator('.note:has-text("remote-only-needle") .reposted').waitFor();
    check('late repost target replaces the mounted loading row', true);
    const note = page.locator(`.note[data-id="${data.remote.id}"]`).first();
    const before = fake.published.length;
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      await note.dispatchEvent('keydown', { key: 'l', code: 'KeyL', [modifier]: true, bubbles: true });
    }
    await page.waitForTimeout(300);
    check('modified note keystrokes never publish', fake.published.length === before);
  });

  for (const refused of [false, true]) {
    const relay = fakeRelay({ request: (ws, sub) => {
      if (!refused) return false;
      ws.send(JSON.stringify(['CLOSED', sub, 'error: refused lookup']));
      return true;
    } });
    await isolated(relay, null, async (page) => {
      await workspace(page, [{ kind: 'thread', id: 'f'.repeat(64), relays: [] }]);
      await page.locator('.thread [role=status]').filter({ hasText: refused ? 'Relays failed or refused' : 'Note not found' }).waitFor();
      check(`missing thread settles after ${refused ? 'refusal' : 'EOSE'}`, true);
    });
  }

  let replyRequests = 0;
  const replyRelay = fakeRelay({ request: (_ws, _sub, filters) => {
    const held = filters.some((f) => f.ids?.includes(data.remote.id));
    if (held) replyRequests += 1;
    return held;
  } });
  await isolated(replyRelay, null, async (page) => {
    await page.click('.topbar .account');
    await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
    await page.getByRole('button', { name: 'Create a new key', exact: true }).click();
    await page.locator('.pane.focused .body.shown .accounts li.active').waitFor();
    await workspace(page, [{ kind: 'compose', reply_to: data.remote.id }]);
    const text = page.getByRole('textbox', { name: 'Note text' });
    await text.fill('Preserve this reply draft');
    check('missing reply parent disables the button', await page.getByRole('button', { name: 'Reply', exact: true }).isDisabled());
    await text.press('Control+Enter');
    await page.getByRole('alert').filter({ hasText: 'reply parent is unavailable' }).waitFor();
    check('missing reply keyboard submission retains draft and publishes nothing', replyRelay.published.length === 0 && await text.inputValue() === 'Preserve this reply draft');
    await waitUntil(page, () => replyRequests >= 3);
    replyRelay.add(data.remote);
    await page.waitForFunction(() => !document.querySelector('.compose-bar button.primary').disabled);
    await text.press('Control+Enter');
    await page.waitForFunction(() => document.querySelector('.compose textarea').value === '');
    check('loaded reply parent supplies reply tags', replyRelay.published.some((e) => e.tags.some((t) => t[0] === 'e' && t[1] === data.remote.id)));
  });

  const authenticated = fakeRelay({ requireAuth: true });
  await isolated(authenticated, null, async (page) => {
    await page.click('.topbar .account');
    await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
    await page.getByRole('button', { name: 'Create a new key', exact: true }).click();
    await page.locator('.pane.focused .body.shown .accounts li.active').waitFor();
    await workspace(page, [{ kind: 'accounts' }]);
    for (let n = 0; n < 50 && (!authenticated.authRetries() || authenticated.connections()); n++) await page.waitForTimeout(100);
    check('accepted AUTH retries closed requests on the open socket', authenticated.authRetries() > 0);
    check('completed session profile lookups release all sockets', authenticated.opened() > 0 && authenticated.connections() === 0);
  });

  const cursors = [];
  const pages = fakeRelay({ request: (ws, sub, filters) => {
    const f = filters.find((f) => f.kinds?.includes(1) && !f.ids && !f.authors && !f['#e']);
    if (!f) return false;
    if (f.until && cursors.length < 50) cursors.push(f.until);
    const events = data.pages.filter((e) => !f.until || e.created_at <= f.until).slice(0, f.limit);
    for (const event of events) ws.send(JSON.stringify(['EVENT', sub, event]));
    ws.send(JSON.stringify(['EOSE', sub]));
    return true;
  } });
  await isolated(pages, null, async (page) => {
    await workspace(page, [{ kind: 'global' }]);
    await page.locator('.note:has-text("Older readable page note")').first().waitFor();
    check('all-noise first page fetches readable older results without scrolling', cursors.length > 0);
    await page.locator('.feed').evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
    await page.locator('.note:has-text("Older readable page note 84")').waitFor();
    check('pagination advances across tied timestamp boundaries', true);
  });
  await browserReview2({ isolated, workspace, data, root, check });
  check('review regressions have no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
}
