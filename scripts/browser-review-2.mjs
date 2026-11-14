// Regression checks for storage cutover, retry lifecycle and displayed references.
import { fakeRelay } from './browser-relay.mjs';

export async function browserReview2({ isolated, workspace, data, root, check }) {
  await isolated(fakeRelay(), null, async (page) => {
    await page.evaluate(async () => {
      const legacy = await new Promise((ok, fail) => {
        const r = indexedDB.open('lkjstr', 18); r.onsuccess = () => ok(r.result); r.onerror = fail;
      });
      legacy.close();
    });
    await page.reload();
    await page.click('.topbar .account');
    await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
    await page.getByRole('button', { name: 'Create a new key', exact: true }).click();
    await page.locator('.pane.focused .body.shown .accounts li.active').waitFor();
    await page.waitForTimeout(600);
    await page.reload();
    await page.locator('.pane.focused .body.shown .accounts li.active').waitFor();
    check('legacy version 18 database does not block new account persistence', true);
  });

  for (const mode of ['throw', 'abort']) {
    const relay = fakeRelay(); relay.add(data.remote);
    await isolated(relay, { arg: mode, fn: (mode) => {
      window.eventWriteAttempts = 0;
      window.failEventWrites = true;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name !== 'events') return put.apply(this, args);
        window.eventWriteAttempts += 1;
        if (window.failEventWrites && mode === 'throw') throw new DOMException('quota', 'QuotaExceededError');
        const r = put.apply(this, args);
        if (window.failEventWrites && mode === 'abort') r.addEventListener('success', () => this.transaction.abort());
        return r;
      };
    } }, async (page) => {
      // Keep Welcome mounted to observe the actual storage state.
      await page.locator('.tab:has-text("Global")').click();
      await page.locator('.note:has-text("remote-only-needle")').first().waitFor();
      await page.getByText('Local storage write failed', { exact: false }).waitFor({ state: 'attached' });
      const first = await page.evaluate(() => window.eventWriteAttempts);
      await page.evaluate(() => { window.failEventWrites = false; });
      await page.waitForFunction((first) => window.eventWriteAttempts > first, first);
      await page.getByText('Local storage ready', { exact: false }).waitFor({ state: 'attached' });
      const cached = await page.evaluate(async (id) => {
        const db = await new Promise((ok) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
        const row = await new Promise((ok) => { const r = db.transaction('events').objectStore('events').get(id); r.onsuccess = () => ok(r.result); });
        db.close(); return !!row;
      }, data.remote.id);
      check(`event ${mode} failure is visible and retries the original batch to commit`, cached);
    });
  }

  await isolated(fakeRelay(), { fn: () => {
    const Socket = window.WebSocket;
    const start = Date.now();
    window.socketThrows = 0;
    window.WebSocket = class extends Socket {
      constructor(...args) {
        if (Date.now() - start < 1200) { window.socketThrows += 1; throw new DOMException('blocked', 'SecurityError'); }
        super(...args);
      }
    };
  } }, async (page) => {
    await page.click('.tab:has-text("Global")');
    await page.getByText('Relays returned no notes.', { exact: true }).waitFor({ timeout: 10000 });
    check('synchronous socket failures back off and retry to completion', await page.evaluate(() => window.socketThrows > 0));
  });

  for (const pointer of ['quote_note', 'quote_nevent']) {
    const requested = [];
    const relay = fakeRelay({ request: (ws, sub, filters) => {
      if (!filters.some((f) => f.ids?.includes(data.remote.id))) return false;
      requested.push(ws.url());
      if (pointer !== 'quote_nevent' || ws.url() === 'wss://quote.example/') {
        ws.send(JSON.stringify(['EVENT', sub, data.remote]));
      }
      ws.send(JSON.stringify(['EOSE', sub])); return true;
    } });
    relay.add(data[pointer]);
    await isolated(relay, null, async (page) => {
      await workspace(page, [{ kind: 'global' }]);
      await page.locator('.quote:has-text("remote-only-needle")').first().waitFor();
      check(`${pointer} without q tags fetches and renders its target`, requested.length > 0);
      if (pointer === 'quote_nevent') check('content pointer relay hint is used for the lookup', requested.includes('wss://quote.example/'));
    });
  }

  for (const kind of ['thread', 'global']) {
    const deleted = fakeRelay(); deleted.add(data.remote);
    await isolated(deleted, null, async (page) => {
      await workspace(page, [kind === 'thread' ? { kind, id: data.remote.id, relays: [] } : { kind }]);
      const note = page.locator(`.note[data-id="${data.remote.id}"]`).first();
      await note.waitFor();
      // Wait until the REQ includes kind 5 before delivering a remote deletion.
      await page.waitForTimeout(200);
      deleted.add(data.deletion);
      await note.waitFor({ state: 'detached' });
      check(`remote deletion removes an already displayed cached ${kind} note`, true);
    });
  }

  const extension = fakeRelay();
  await isolated(extension, { arg: { root, signed: data.remote }, fn: ({ root, signed }) => {
    window.nostr = { getPublicKey: async () => root.pubkey, signEvent: async () => signed };
  } }, async (page) => {
    await page.click('.topbar .account');
    await page.getByRole('menuitem', { name: 'Sign in or create a key', exact: true }).click();
    await page.getByRole('button', { name: 'Use signer extension', exact: true }).click();
    await page.locator('.pane.focused .body.shown .accounts li.active').waitFor();
    await page.locator('.pane textarea').fill('Extension must not replace this event');
    await page.locator('.pane textarea').press('Control+Enter');
    await page.getByRole('alert').filter({ hasText: 'signer changed the requested event' }).waitFor();
    check('extension event substitution is rejected before publication', extension.published.length === 0);
  });
}
