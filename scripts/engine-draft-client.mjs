// Owned test clients only; no saved browser profile or external account is discovered.
export async function draftClients({page, origin, note, signer, lines, kinds}) {
  let serial = 0;
  const handled = new Set();
  const messages = name => page.evaluate(name => window.draftClients[name].messages, name);
  const send = (name, input) => page.evaluate(({name, input}) =>
    window.draftClients[name].worker.postMessage(input), {name, input});
  async function start(name) {
    await page.evaluate(name => {
      window.draftClients ??= {};
      window.draftClients[name]?.worker.terminate();
      const client = {messages: [], worker: new Worker('/archive-worker.js', {type:'module'})};
      client.worker.onmessage = e => client.messages.push(e.data);
      client.worker.onerror = e => client.messages.push({t:'worker-error', message:e.message});
      window.draftClients[name] = client;
    }, name);
    await page.waitForFunction(name => window.draftClients[name].messages.some(m => m.t === 'ready'), name);
    await send(name, {t:'test.relays', relays:[origin.replace('http:', 'ws:')]});
  }
  async function answer(name, request) {
    handled.add(name + ':' + request.req);
    if (request.pubkey !== note.pubkey || request.t !== 'crypt') throw new Error('unexpected archive signer');
    signer.stdin.write(JSON.stringify({fixtureCrypto:request}) + '\n');
    const reply = JSON.parse((await lines.next()).value);
    await send(name, {t:'crypted', req:request.req, value:reply.value});
  }
  async function until(name, predicate, automate = true) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const all = await messages(name);
      for (const request of all.filter(m => m.t === 'getPublicKey' && !handled.has(name + ':identity:' + m.req))) {
        handled.add(name + ':identity:' + request.req);
        await send(name, {t:'publicKey', req:request.req, pubkey:note.pubkey});
      }
      if (automate) {
        for (const request of all.filter(m => m.t === 'crypt' && !handled.has(name + ':' + m.req))) {
          await answer(name, request);
        }
      }
      if (predicate(all)) return all;
      if (all.some(m => m.t === 'worker-error')) throw new Error('archive Worker failed');
      await page.waitForTimeout(20);
    }
    throw new Error('private archive operation timed out');
  }
  async function begin(name, action) {
    kinds?.add(action.a);
    const req = 'archive-contract-' + (++serial);
    await send(name, {t:'act', req, action});
    return req;
  }
  async function finish(name, req, automate = true) {
    const all = await until(name, all => all.some(m => m.t === 'result' && m.req === req), automate);
    return all.find(m => m.t === 'result' && m.req === req);
  }
  const act = async (name, action) => finish(name, await begin(name, action));
  async function hold(name, action) {
    const before = new Set((await messages(name)).filter(m => m.t === 'crypt').map(m => m.req));
    const req = await begin(name, action);
    const all = await until(name, all => all.some(m => m.t === 'crypt' && !before.has(m.req)), false);
    const crypt = all.find(m => m.t === 'crypt' && !before.has(m.req));
    handled.add(name + ':' + crypt.req);
    return {req, crypt};
  }
  async function barrier(name) {
    const before = (await messages(name)).filter(m => m.t === 'heartbeat').length;
    await send(name, {t:'heartbeat'});
    await until(name, all => all.filter(m => m.t === 'heartbeat').length > before, false);
  }
  return {start, send, messages, act, begin, finish, hold, answer, barrier};
}
export async function archiveDisk(page, accounts, markers) {
  return page.evaluate(async ({accounts, markers}) => {
    const db = await new Promise((ok, bad) => {
      const request = indexedDB.open('lkjstr-wasm');
      request.onsuccess = () => ok(request.result); request.onerror = bad;
    });
    try {
      const read = (store, key) => new Promise((ok, bad) => {
        const request = key === undefined ? db.transaction(store).objectStore(store).getAll()
          : db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => ok(request.result); request.onerror = bad;
      });
      const records = await Promise.all(accounts.map(a => read('kv', 'dm-drafts-v1:' + a)));
      const values = JSON.stringify([await read('kv'), await read('events'), Object.values(localStorage)]);
      return {privateTextAbsent:markers.every(marker => !values.includes(marker)),
        archives:records.map(raw => raw === undefined ? null : {
          keys:Object.keys(JSON.parse(raw)).sort(), bytes:raw.length,
          segments:JSON.parse(raw).cipherCatalog.length,
        }), generation:await read('kv', 'dm-drafts-generation-v1')};
    } finally { db.close(); }
  }, {accounts, markers});
}
