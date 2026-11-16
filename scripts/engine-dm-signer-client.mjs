// Fresh browser contexts and ephemeral accounts; public WebSockets are blocked by the boot script.
export async function signerClient({browser, origin, fixtures, fake, recipient = 'extension'}) {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin);
  let serial = 0;
  const actions = new Map();
  const identity = new Set();
  const handled = new Set(), publicKey = fixtures.extension.first.note.pubkey;
  const messages = () => page.evaluate(() => window.messages);
  const send = input => page.evaluate(input => window.worker.postMessage(input), input);
  async function until(predicate, ms = 15_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const all = await messages();
      for (const request of all.filter(m => m.t === 'getPublicKey' && !identity.has(m.req))) {
        identity.add(request.req);
        await send({t:'publicKey', req:request.req, pubkey:publicKey});
      }
      if (all.some(m => m.t === 'worker-error')) throw new Error('private signer Worker error');
      if (predicate(all)) return all;
      await page.waitForTimeout(20);
    }
    const all = await messages(), last = all.filter(m => m.t === 'dm').at(-1)?.snapshot;
    throw new Error('private signer predicate timeout ' + JSON.stringify({phase:last?.phase, error:last?.error,
      undecryptable:last?.undecryptable, cryptCalls:all.filter(m => m.t === 'crypt').length}));
  }
  await page.evaluate(() => {
    window.messages = [];
    window.worker = new Worker('/worker.js', {type:'module'});
    window.worker.onmessage = event => window.messages.push(event.data);
    window.worker.onerror = event => window.messages.push({t:'worker-error', error:event.message});
  });
  await until(all => all.some(m => m.t === 'ready'));
  await send({t:'relays', relays:[{url:origin.replace('http:', 'ws:'), read:true, write:true, search:true}]});
  async function begin(action) {
    const req = 'signer-case-' + (++serial);
    actions.set(req, action.a);
    await send({t:'act', req, action}); return req;
  }
  async function finish(req) {
    try {
      const all = await until(all => all.some(m => m.t === 'result' && m.req === req), 30_000);
      return all.find(m => m.t === 'result' && m.req === req);
    } catch (error) {
      const tail = (await messages()).slice(-12).map(m => ({t:m.t, req:m.req, error:m.error, version:m.version}));
      throw new Error(String(error) + ' in ' + actions.get(req) + ' ' + JSON.stringify(tail));
    }
  }
  const act = async action => finish(await begin(action));
  async function must(action) {
    const result = await act(action);
    if (!result.ok) throw new Error('fixture action failed: ' + action.a + ':' + result.error?.code);
    return result;
  }
  const active = async () => (await messages()).filter(m => m.t === 'accounts').at(-1).active;
  const relay = origin.replace('http:', 'ws:');
  await must({a:'account.add', how:'create'});
  const sender = await active();
  await must({a:'dm.relays.save', as:sender, relays:[relay]});
  let account;
  if (recipient === 'local') {
    await must({a:'account.add', how:'create'}); account = await active();
    await must({a:'dm.relays.save', as:account, relays:[relay]});
  } else if (recipient === 'extension') {
    await must({a:'account.add', how:'extension', key:publicKey}); account = publicKey;
    fake.add(await fixtures.extension.call({pubkey:account, kind:10050,
      created_at:Math.floor(Date.now()/1000), tags:[['relay', relay]], content:''}));
  } else {
    await must({a:'account.add', how:'key', key:'bunker://' + fixtures.pubkey + '?relay=' + encodeURIComponent(relay + '/bunker')});
    account = fixtures.pubkey;
    fake.add(await fixtures.fixture(10050, [['relay', relay]], Math.floor(Date.now()/1000)));
  }
  for (let i = 0; i < 2; i++) {
    await must({a:'dm.send', as:sender, draft:{recipients:[account], text:'private signer fixture ' + i}});
  }
  const crypts = async () => (await messages()).filter(m => m.t === 'crypt' && m.pubkey === account);
  const snapshot = async () => (await messages()).filter(m => m.t === 'dm' && m.sub === 'private').at(-1)?.snapshot;
  const open = () => send({t:'dm.open', sub:'private', query:{account}});
  async function barrier() {
    const count = (await messages()).filter(m => m.t === 'heartbeat').length;
    await send({t:'heartbeat'});
    await until(all => all.filter(m => m.t === 'heartbeat').length > count);
  }
  async function answer(request, error) {
    handled.add(request.req);
    if (error) return send({t:'crypted', req:request.req, error});
    const reply = await fixtures.extension.call({fixtureCrypto:request});
    await send({t:'crypted', req:request.req, value:reply.value});
  }
  async function decryptAll() {
    const end = Date.now() + 15_000;
    while (Date.now() < end) {
      for (const request of await crypts()) if (!handled.has(request.req)) await answer(request);
      if ((await snapshot())?.conversations.some(c => c.unread >= 2)) return;
      await page.waitForTimeout(25);
    }
    throw new Error('private signer failed to decrypt both cached messages');
  }
  return {page, account, sender, relay, send, messages, until, begin, finish, act, must, open, crypts, snapshot,
    barrier, answer, decryptAll, ignore:request => handled.add(request.req), close:() => context.close()};
}
