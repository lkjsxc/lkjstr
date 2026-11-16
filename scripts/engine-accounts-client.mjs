// Fresh-account fixture data stays inside the page. Only booleans leave it.
export async function accountsClient(context, origin) {
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate(() => {
    const hosts = new Map(), ids = new Map();
    let serial = 0;
    const passphrase = 'owned-account-persistence-fixture';
    const bounded = (promise, label, ms = 15_000) => {
      let timer;
      return Promise.race([promise, new Promise((_, bad) => {
        timer = setTimeout(() => bad(Error(label)), ms);
      })]).finally(() => clearTimeout(timer));
    };
    async function boot(name, graph = 'current') {
      const entry = { ready: false, listed: false, stopped: false, accounts: [], active: null, waiting: new Map(), errors: 0 };
      let ready;
      const started = new Promise(ok => { ready = ok; });
      const worker = new Worker('/' + graph + '/worker.js?host=' + name, { type: 'module' });
      entry.worker = worker; hosts.set(name, entry);
      worker.onerror = () => { entry.errors++; };
      worker.onmessage = event => {
        const m = event.data;
        if (m.fixture === 'stopped') { entry.stopped = true; return; }
        if (m.t === 'ready') entry.ready = true;
        if (m.t === 'accounts') { entry.listed = true; entry.accounts = m.accounts; entry.active = m.active; }
        if (entry.ready && entry.listed) ready();
        if (m.t === 'result') {
          const settle = entry.waiting.get(m.req);
          entry.waiting.delete(m.req);
          if (settle) settle(m);
        }
      };
      await bounded(started, 'owned account boot deadline');
      worker.postMessage({ t: 'relays', relays: [] });
      return true;
    }
    async function act(name, action, allowFailure = false) {
      const entry = hosts.get(name), req = 'account-proof-' + (++serial);
      if (!entry || entry.waiting.size >= 4) throw Error('owned account request bound');
      const waiting = new Promise(ok => entry.waiting.set(req, ok));
      entry.worker.postMessage({ t: 'act', req, action });
      try {
        const result = await bounded(waiting, 'owned account action deadline');
        if (!result.ok && !allowFailure) throw Error('owned account action rejected');
        return result;
      } finally { entry.waiting.delete(req); }
    }
    async function stop(name) {
      const entry = hosts.get(name);
      if (!entry) return true;
      entry.worker.postMessage({ t: 'fixture.stop' });
      const end = performance.now() + 5000;
      while (!entry.stopped && performance.now() < end) await new Promise(ok => setTimeout(ok, 10));
      entry.worker.terminate(); entry.accounts = []; entry.active = null; hosts.delete(name);
      if (!entry.stopped) throw Error('owned account stop deadline');
      return true;
    }
    function publicState(entry) {
      const has = label => entry.accounts.some(a => a.author?.pubkey === ids.get(label));
      const protectedKey = label => entry.accounts.some(a => a.author?.pubkey === ids.get(label) && a.encrypted === true);
      return { aPresent: has('a'), bPresent: has('b'), aProtected: protectedKey('a'), bProtected: protectedKey('b'),
        aActive: entry.active === ids.get('a'), bActive: entry.active === ids.get('b'), noWorkerError: entry.errors === 0 };
    }
    async function durable() {
      return bounded(new Promise((ok, bad) => {
        const open = indexedDB.open('lkjstr-wasm');
        open.onerror = () => bad(Error('owned account observation open failed'));
        open.onupgradeneeded = () => { open.transaction.abort(); };
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('kv'), request = tx.objectStore('kv').get('engine-accounts');
          tx.onabort = () => { db.close(); bad(Error('owned account observation aborted')); };
          tx.oncomplete = () => {
            try {
              const stored = JSON.parse(request.result), entries = stored.entries;
              if (!Array.isArray(entries)) throw Error('invalid owned account observation');
              const has = label => entries.some(a => a.pubkey === ids.get(label));
              const protectedKey = label => entries.some(a => a.pubkey === ids.get(label) && typeof a.encrypted_key === 'string');
              const plaintext = label => entries.some(a => a.pubkey === ids.get(label) && typeof a.secret === 'string');
              ok({ aPresent: has('a'), bPresent: has('b'), aProtected: protectedKey('a'), bProtected: protectedKey('b'),
                aPlaintext: plaintext('a'), bPlaintext: plaintext('b') });
            } catch { bad(Error('invalid owned account observation')); }
            finally { db.close(); }
          };
        };
      }), 'owned account observation deadline');
    }
    window.accountPersistence = {
      async prepare() {
        await boot('first'); await act('first', { a: 'account.add', how: 'create' });
        const entry = hosts.get('first');
        if (!/^[a-f0-9]{64}$/.test(entry.active ?? '')) throw Error('owned account identity missing');
        ids.set('a', entry.active); await boot('second');
        return publicState(hosts.get('second'));
      },
      async addSecond() {
        await act('second', { a: 'account.add', how: 'create' });
        const entry = hosts.get('second');
        if (!/^[a-f0-9]{64}$/.test(entry.active ?? '') || entry.active === ids.get('a')) throw Error('owned account identity collision');
        ids.set('b', entry.active); return durable();
      },
      async protectFirst() {
        let result = await act('second', { a: 'account.exportEncrypted', pubkey: ids.get('a'), password: passphrase, logN: 16 });
        if (typeof result.encryptedKey !== 'string') throw Error('owned encrypted fixture missing');
        try { await act('second', { a: 'account.importEncrypted', key: result.encryptedKey, password: passphrase }); }
        finally { result.encryptedKey = undefined; result = undefined; }
        return durable();
      },
      async staleSeen() {
        const result = await act('first', { a: 'seen', as: ids.get('a') }, true);
        return { acknowledged: result.ok === true, ...await durable() };
      },
      async currentSeen() {
        const result = await act('fresh', { a: 'seen', as: ids.get('a') });
        return { acknowledged: result.ok === true, ...await durable() };
      },
      async reload() { await boot('fresh'); return publicState(hosts.get('fresh')); },
      async close() { for (const name of [...hosts.keys()]) await stop(name); ids.clear(); return true; },
    };
  });
  return {
    page,
    prepare: () => page.evaluate(() => window.accountPersistence.prepare()),
    addSecond: () => page.evaluate(() => window.accountPersistence.addSecond()),
    protectFirst: () => page.evaluate(() => window.accountPersistence.protectFirst()),
    staleSeen: () => page.evaluate(() => window.accountPersistence.staleSeen()),
    reload: () => page.evaluate(() => window.accountPersistence.reload()),
    currentSeen: () => page.evaluate(() => window.accountPersistence.currentSeen()),
    close: async () => { await page.evaluate(() => window.accountPersistence.close()); await page.close(); },
  };
}
