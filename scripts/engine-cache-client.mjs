// Actual production Workers, same fresh database; only public fixture events enter it.
export async function cacheClient(context, origin, pubkey, noteId) {
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate(({ pubkey, noteId }) => {
    const hosts = new Map();
    const bound = async (promise, name, ms = 15_000) => {
      let timer;
      return Promise.race([promise, new Promise((_, bad) => { timer = setTimeout(() => bad(Error(name)), ms); })])
        .finally(() => clearTimeout(timer));
    };
    const delay = ms => new Promise(ok => setTimeout(ok, ms));
    async function dbWork(mode, callback) {
      return bound(new Promise((ok, bad) => {
        const request = indexedDB.open('lkjstr-wasm');
        request.onupgradeneeded = () => { request.transaction.abort(); };
        request.onerror = () => bad(Error('cache fixture database open failed'));
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction(['events', 'kv'], mode);
          let result;
          tx.oncomplete = () => { db.close(); ok(typeof result === 'function' ? result() : result); };
          tx.onabort = () => { db.close(); bad(Error('cache fixture database transaction aborted')); };
          try { result = callback(tx); } catch { tx.abort(); }
        };
      }), 'cache fixture database deadline');
    }
    async function stop(name) {
      const h = hosts.get(name);
      if (!h) return;
      h.worker.postMessage({ t: 'fixture.stop' });
      const end = performance.now() + 5000;
      while (!h.stopped && performance.now() < end) await delay(10);
      h.worker.terminate(); hosts.delete(name);
      if (!h.stopped) throw Error('cache fixture stop deadline');
    }
    async function boot(name, offline, options = {}) {
      const h = { ready: false, listed: false, rows: new Map(), errors: 0, stopped: false,
        aborts: 0, allowed: false, firstNoteMs: null, firstNameMs: null };
      hosts.set(name, h);
      h.worker = new Worker('/current/worker.js?offline=' + Number(offline) + '&abortMetadata=' + Number(!!options.abortMetadata), { type: 'module' });
      let ready; const loading = new Promise(ok => { ready = ok; });
      h.worker.onerror = () => { h.errors++; };
      h.worker.onmessage = event => {
        const m = event.data;
        if (m.fixture === 'stopped') { h.stopped = true; return; }
        if (m.fixture === 'metadata-aborted') { h.aborts++; return; }
        if (m.fixture === 'metadata-allowed') { h.allowed = true; return; }
        if (m.t === 'ready') h.ready = true;
        if (m.t === 'accounts') h.listed = true;
        if (h.ready && h.listed) ready();
        for (const row of [...(m.rows ?? []), ...(m.ops ?? []).flatMap(op => op.row ? [op.row] : [])]) {
          if (row.kind !== 'note') continue;
          h.rows.set(row.id, row);
          if (row.id === noteId) {
            h.firstNoteMs ??= performance.now() - h.opened;
            if (row.author?.name === 'cache-fixture' && row.author?.picture === 'https://cache-fixture.invalid/picture.png') {
              h.firstNameMs ??= performance.now() - h.opened;
            }
          }
        }
      };
      h.worker.postMessage({ t: 'relays', relays: offline ? [] : [{ url: location.origin.replace('http:', 'ws:') + (options.relayPath ?? '/relay'), read: true, write: false, search: false }] });
      await bound(loading, 'cache fixture Worker readiness');
      h.opened = performance.now();
      h.worker.postMessage({ t: 'open', sub: 'cache-home', query: { source: 'home', account: pubkey } });
    }
    async function observe(name, waitMs = 3000) {
      const h = hosts.get(name), end = performance.now() + waitMs;
      while (h.firstNameMs === null && performance.now() < end) await delay(10);
      const row = h.rows.get(noteId);
      return { firstNoteMs: h.firstNoteMs, firstNameMs: h.firstNameMs, hasNote: !!row,
        hasName: row?.author?.name === 'cache-fixture',
        hasPicture: row?.author?.picture === 'https://cache-fixture.invalid/picture.png', workerErrors: h.errors };
    }
    window.cacheProof = {
      boot, observe, stop,
      async waitAbort(name) {
        const h = hosts.get(name), end = performance.now() + 10_000;
        while (h.aborts === 0 && performance.now() < end) await delay(10);
        if (!h.aborts) throw Error('cache metadata abort was not observed');
        return h.aborts;
      },
      async allow(name) {
        const h = hosts.get(name); h.worker.postMessage({ t: 'fixture.metadata.allow' });
        const end = performance.now() + 5000;
        while (!h.allowed && performance.now() < end) await delay(10);
        if (!h.allowed) throw Error('cache metadata unblock deadline');
      },
      inspect(ids) {
        return dbWork('readonly', tx => {
          const requests = ids.map(id => tx.objectStore('events').get(id));
          const metadata = tx.objectStore('kv').get('verified-public-metadata-v1');
          return () => ({ existingIds: requests.filter(r => !!r.result).map(r => r.result.id),
            metadataIds: typeof metadata.result === 'string' ? JSON.parse(metadata.result).rows.map(row => row.id) : [] });
        });
      },
      async waitSaved(ids) {
        const end = performance.now() + 15_000;
        while (performance.now() < end) {
          const result = await dbWork('readonly', tx => {
            const requests = ids.map(id => tx.objectStore('events').get(id));
            const metadata = tx.objectStore('kv').get('verified-public-metadata-v1');
            return () => ({ saved: requests.every(r => !!r.result), receipts: requests.every(r => typeof r.result?.receipt === 'string'),
              checkpoint: typeof metadata.result === 'string' });
          });
          if (result.saved) return result;
          await delay(50);
        }
        throw Error('cache fixture persistence deadline');
      },
      seed(events) {
        return dbWork('readwrite', tx => {
          for (const event of events) tx.objectStore('events').put({ id: event.id, created_at: event.created_at, raw: JSON.stringify(event) });
          return { inserted: events.length };
        });
      },
      corrupt(id) {
        return dbWork('readwrite', tx => {
          const store = tx.objectStore('events'), request = store.get(id);
          request.onsuccess = () => {
            const row = request.result; row.raw = row.raw.replace('cache bootstrap fixture', 'tampered cache fixture');
            store.put(row);
          };
        });
      },
      async close() { for (const name of [...hosts.keys()]) await stop(name); },
    };
  }, { pubkey, noteId });
  return { page, call: (name, ...args) => page.evaluate(({ name, args }) => window.cacheProof[name](...args), { name, args }),
    close: async () => { await page.evaluate(() => window.cacheProof.close()); await page.close(); } };
}
