// Only named boolean assertions leave these fresh pages; keys and raw rows never do.
export async function accountsGuardsClient(context, origin) {
  const page = await context.newPage(); await page.goto(origin);
  await page.evaluate(() => {
    const hosts = new Map(), heldDbs = new Set(); let serial = 0, account;
    const ACCOUNT = 'engine-accounts', REVISION = 'engine-accounts-cas-v2', GENERATION = 'dm-drafts-generation-v1';
    const MARKER = 'owned-account-guard-marker', marker = 'explicit fixture marker';
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    async function until(test, label, ms = 20_000) {
      const end = performance.now() + ms;
      do { const value = await test(); if (value) return value; await pause(10); } while (performance.now() < end);
      throw Error(label);
    }
    function receiver(entry, message) {
      if (message.fixture === 'started') entry.started = true;
      if (message.fixture === 'stopped') entry.stopped = true;
      if (message.fixture === 'audit') entry.audits.set(message.req, message.audit);
      if (message.t === 'ready') entry.ready++;
      if (message.t === 'accounts') { entry.listed++; entry.accounts = message.accounts; entry.active = message.active; }
      if (message.t === 'result') { if (entry.results.size >= 32) entry.overflow = true; else entry.results.set(message.req, message); }
      if (message.t === 'state') { if (entry.states.size >= 16) entry.overflow = true; else entry.states.set(message.sub, message.state); }
    }
    function entry() { return { ready: 0, listed: 0, accounts: [], active: null, results: new Map(), states: new Map(), audits: new Map(), errors: 0, overflow: false }; }
    async function start(name, graph = 'current', fault = '', broker = false, prequeued = false) {
      const e = entry(); e.prequeued = prequeued; e.ports = []; e.worker = new Worker('/' + graph + '/guard-worker.js?fault=' + fault + (broker ? '&broker=1' : '') + (prequeued ? '&prequeue=1' : ''), { type: 'module' });
      hosts.set(name, e); e.worker.onerror = () => e.errors++;
      e.worker.onmessage = event => receiver(e, event.data); e.post = message => e.worker.postMessage(message);
      await until(() => e.started, 'owned guard bootstrap deadline');
      if (broker) return attach(e);
      e.post({ t: 'relays', relays: [] }); return e;
    }
    function attach(root) {
      const e = entry(), channel = new MessageChannel(); root.ports.push(channel.port1);
      e.root = root; e.post = message => channel.port1.postMessage(message);
      channel.port1.onmessage = event => receiver(e, event.data); channel.port1.start();
      root.worker.postMessage({ fixture: 'attach' }, [channel.port2]); e.post({ t: 'relays', relays: [] }); return e;
    }
    async function action(e, action) {
      const req = 'guard-' + (++serial); e.post({ t: 'act', req, action });
      try { return await until(() => e.results.get(req), 'owned guard action deadline'); }
      finally { e.results.delete(req); }
    }
    function open(e) { const sub = 'guard-view-' + (++serial); e.post({ t: 'open', sub, query: { source: 'global' } }); return sub; }
    async function audit(e) {
      e = e.root ?? e; const req = 'audit-' + (++serial); e.worker.postMessage({ fixture: 'audit', req });
      try { return await until(() => e.audits.get(req), 'owned guard audit deadline', 3000); }
      finally { e.audits.delete(req); }
    }
    async function halt(e) { e = e.root ?? e; e.worker.postMessage({ fixture: 'stop' }); await until(() => e.stopped, 'owned guard stop deadline', 5000); }
    async function close(name) {
      const e = hosts.get(name); if (!e) return;
      try { if (!e.stopped) await halt(e); }
      finally { for (const port of e.ports) port.close(); e.worker.terminate(); hosts.delete(name); e.accounts = []; }
    }
    function db(version) {
      return new Promise((ok, bad) => {
        const request = version === undefined ? indexedDB.open('lkjstr-wasm') : indexedDB.open('lkjstr-wasm', version);
        let live = true; const timer = setTimeout(() => { live = false; bad(Error('owned database deadline')); }, 5000);
        request.onupgradeneeded = () => request.transaction.abort();
        request.onerror = () => { clearTimeout(timer); bad(Error(request.error?.name ?? 'owned database failed')); };
        request.onsuccess = () => { clearTimeout(timer); if (live) ok(request.result); else request.result.close(); };
      });
    }
    async function kv(write, work) {
      const database = await db();
      try { return await new Promise((ok, bad) => {
        const tx = database.transaction('kv', write ? 'readwrite' : 'readonly'); let finish;
        try { finish = work(tx.objectStore('kv'), database.version); } catch { tx.abort(); }
        tx.onabort = () => bad(Error('owned observation aborted'));
        tx.oncomplete = () => { try { ok(finish?.()); } catch { bad(Error('owned observation invalid')); } };
      }); } finally { database.close(); }
    }
    const archive = () => 'dm-drafts-v1:' + account;
    async function snapshot() {
      return kv(false, (store, version) => {
        const rows = [ACCOUNT, REVISION, archive(), GENERATION, MARKER].map(key => [key, store.get(key), store.getKey(key)]);
        return () => ({ version, rows: Object.fromEntries(rows.map(([key, value, present]) => [key, { value: value.result, present: present.result !== undefined }])) });
      });
    }
    const same = (left, right, omit = []) => Object.keys(left.rows).filter(key => !omit.includes(key)).every(key =>
      left.rows[key].present === right.rows[key].present && left.rows[key].value === right.rows[key].value);
    async function seed(graph = 'current', fault = '') {
      const e = await start('seed', graph, fault); await until(() => e.ready && e.listed, 'owned seed boot deadline');
      if (!(await action(e, { a: 'account.add', how: 'create' })).ok) throw Error('owned seed create failed');
      account = e.active; if (!/^[a-f0-9]{64}$/.test(account ?? '')) throw Error('owned seed identity missing');
      await kv(true, store => { store.put(marker, MARKER); store.put('explicit opaque fixture archive', archive()); store.put('0'.repeat(32), GENERATION); });
      return e;
    }
    async function failure(e, check) {
      const queued = e.prequeued ? until(() => e.results.get('guard-preboot-action'), 'owned queued action deadline') : action(e, { a: 'account.add', how: 'create' });
      const first = e.prequeued ? 'guard-preboot-view' : open(e);
      await until(() => e.ready, 'owned failed handshake deadline');
      const result = await queued; await until(() => e.states.get(first), 'owned queued view deadline');
      check('failed boot sends Ready without Accounts', e.ready > 0 && e.listed === 0);
      if (e.prequeued) check('normal inputs were delivered before boot could finish', (await audit(e)).prebootInputs === 2);
      check('initial action fails explicitly', result.ok === false && result.error?.code === 'internal');
      check('initial subscription fails explicitly', e.states.get(first).phase === 'failed');
      const future = await action(e, { a: 'account.add', how: 'create' }), second = open(e);
      await until(() => e.states.get(second), 'owned future view deadline');
      check('future action and subscription fail', future.ok === false && future.error?.code === 'internal' && e.states.get(second).phase === 'failed' && e.listed === 0);
    }
    async function healthy(e, check) {
      const data = await audit(e); check('bounded worker has no outside effects or errors', !e.errors && !(e.root?.errors) && !e.overflow && !data.overflow && !data.sockets && !data.http);
      return data;
    }
    async function run(kind) {
      const checks = [], check = (name, ok) => checks.push({ name: kind + ': ' + name, ok: !!ok });
      if (kind === 'genuine-absence') {
        const e = await start('empty'); await until(() => e.ready && e.listed, 'owned empty boot deadline');
        check('confirmed absence is a loaded empty account set', e.accounts.length === 0);
        check('fresh account creation succeeds', (await action(e, { a: 'account.add', how: 'create' })).ok === true); await healthy(e, check);
      } else if (/^v[12]-/.test(kind) || kind === 'shared-failure') {
        const version = kind.startsWith('v1-') ? 1 : 2; await seed(version === 1 ? 'legacy' : 'current'); await close('seed');
        const key = kind.endsWith('revision') ? REVISION : ACCOUNT;
        if (kind !== 'v2-read-error') await kv(true, store => { store.put(kind.includes('malformed') ? '{invalid' : undefined, key); });
        const before = await snapshot(), e = await start('failed', 'current', kind === 'v2-read-error' ? 'read-error' : '', kind === 'shared-failure', kind !== 'shared-failure');
        await failure(e, check); const after = await snapshot();
        check('failure leaves exact existing records and schema untouched', after.version === version && same(before, after));
        const observed = await healthy(e, check);
        if (kind === 'v2-read-error') check('actual read transaction abort was observed', observed.injected === 1 && observed.readErrors > 0);
        if (kind === 'shared-failure') { const later = attach(e.root); await failure(later, check); }
      } else if (kind === 'blocked-timeout' || kind === 'stopped-blocked') {
        await seed('legacy'); await close('seed'); const before = await snapshot(), blocker = await db(1); heldDbs.add(blocker);
        let changes = 0; blocker.onversionchange = () => changes++;
        const e = await start('blocked', 'current', '', false, kind === 'blocked-timeout'); await until(async () => (await audit(e)).blocked > 0, 'owned upgrade blocked deadline', 5000);
        check('legacy connection actually blocks schema upgrade', changes > 0 && (await audit(e)).upgrades === 0);
        if (kind === 'blocked-timeout') await failure(e, check); else { await halt(e); check('stopped opener emits no account snapshot', e.listed === 0); }
        blocker.close(); heldDbs.delete(blocker);
        await until(async () => (await audit(e)).openErrors > 0, 'owned abandoned upgrade deadline', 5000);
        const after = await snapshot(), observed = await audit(e);
        check('late upgrade aborts without adopting or changing rows', observed.upgrades === 1 && observed.successes === 0 && after.version === 1 && same(before, after) && (kind !== 'stopped-blocked' || e.ready === 0));
        const fresh = await start('fresh'); await until(() => fresh.ready && fresh.listed, 'owned fresh migration deadline');
        const migrated = await snapshot(); check('fresh opener migrates and preserves all prior rows', migrated.version === 2 && same(before, migrated, [REVISION]) && fresh.accounts.some(a => a.author.pubkey === account));
        let denied = false; try { const old = await db(1); old.close(); } catch (error) { denied = error.message === 'VersionError'; }
        check('old explicit schema is fenced', denied); await healthy(e, check); await healthy(fresh, check);
      } else if (kind === 'stopped-success' || kind === 'timeout-success') {
        await seed(); await close('seed'); const before = await snapshot(), e = await start('held', 'current', 'hold-success', false, kind === 'timeout-success');
        await until(async () => (await audit(e)).held === 1, 'owned native success hold deadline', 5000);
        check('a real native connection completed before callback release', (await audit(e)).successes === 1 && e.listed === 0);
        if (kind === 'timeout-success') await failure(e, check); else { await halt(e); check('owner stopped before callback release', e.stopped && e.listed === 0); }
        e.worker.postMessage({ fixture: 'release' });
        await until(async () => (await audit(e)).closed === 1, 'owned late connection close deadline', 5000);
        check('late success closes its connection without adopting accounts', e.listed === 0 && (kind !== 'stopped-success' || e.ready === 0) && same(before, await snapshot())); await healthy(e, check);
      } else if (kind === 'removal-conflict' || kind === 'removal-abort') {
        const first = await seed('current', kind === 'removal-abort' ? 'abort-removal' : '');
        let writer = first;
        if (kind === 'removal-conflict') {
          writer = await start('writer'); await until(() => writer.ready && writer.listed, 'owned second writer deadline');
          if (!(await action(writer, { a: 'account.add', how: 'create' })).ok) throw Error('owned second create failed');
        }
        const before = await snapshot(), offset = (await audit(first)).transactions.length;
        const result = await action(first, { a: 'account.remove', pubkey: account }), after = await snapshot(), trace = await audit(first);
        check('rejected removal reports failure', result.ok === false);
        check('rejected removal preserves account archive and generation exactly', same(before, after));
        const attempt = trace.transactions.slice(offset);
        check('rejected removal has no committed account/archive transaction', !attempt.some(row => row.complete && (row.account || row.archive || row.generation)));
        if (kind === 'removal-abort') check('actual removal transaction abort was injected', trace.injected === 1 && attempt.some(row => row.aborted && row.account && row.revision && row.archive && row.generation));
        else {
          const currentOffset = (await audit(writer)).transactions.length;
          check('current snapshot removal succeeds', (await action(writer, { a: 'account.remove', pubkey: account })).ok === true);
          const current = await snapshot(), commits = (await audit(writer)).transactions.slice(currentOffset);
          check('removal publishes one complete atomic account/archive/generation transaction', commits.some(row => row.complete && !row.aborted && row.account && row.revision && row.archive && row.generation));
          const entries = JSON.parse(current.rows[ACCOUNT].value).entries;
          check('committed removal preserves the other account and rotates only its archive metadata', !current.rows[archive()].present && /^[a-f0-9]{32}$/.test(current.rows[GENERATION].value) && current.rows[GENERATION].value !== before.rows[GENERATION].value && current.rows[MARKER].value === marker && entries.length === 1 && entries[0].pubkey === writer.active && writer.active !== account);
        }
        await healthy(first, check);
      } else throw Error('unknown owned guard case');
      return checks;
    }
    window.accountGuards = { run, async close() {
      let failed = false;
      for (const database of heldDbs) database.close(); heldDbs.clear();
      for (const name of [...hosts.keys()]) { try { await close(name); } catch { failed = true; } }
      account = undefined; if (failed) throw Error('owned guard cleanup incomplete'); return true;
    } };
  });
  return { page, run: kind => page.evaluate(kind => window.accountGuards.run(kind), kind),
    close: async () => { try { await page.evaluate(() => window.accountGuards.close()); } finally { await page.close(); } } };
}
