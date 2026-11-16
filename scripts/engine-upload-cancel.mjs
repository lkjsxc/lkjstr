// Cancellation against real loopback TLS sockets, plus all three signer kinds.
// Caller supplies a context created with ignoreHTTPSErrors:true. Only exact fixture origins are allowed.
import { fakeMediaSet } from './browser-media.mjs';
import { uploadOwnership } from './engine-upload-ownership.mjs';
export async function uploadCancel({ page, send, wait, check, note, signer, lines, bunker, origin }) {
  const media = await fakeMediaSet();
  const created = [], pending = new Set(), answered = new Set();
  const pass = route => route.continue();
  const allowed = Object.values(media.origins).map(url => url + '/**');
  const before = await page.evaluate(() => window.messages.filter(m => m.t === 'accounts').at(-1));
  const oldActive = before?.active;
  const oldKeys = new Set((before?.accounts ?? []).map(a => a.author.pubkey));
  let serial = 0;
  const all = () => page.evaluate(() => window.messages);
  const answer = async request => {
    if (request.pubkey !== note.pubkey) throw new Error('unexpected cancellation fixture signer');
    answered.add(request.req);
    signer.stdin.write(request.event + '\n');
    const event = JSON.parse((await lines.next()).value);
    await send({ t: 'signed', req: request.req, event: JSON.stringify(event) });
  };
  async function drive(req, done, sign = true) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const messages = await all();
      if (sign) for (const request of messages.filter(m => m.t === 'sign' && (m.actionReq === req || m.req === req) && !answered.has(m.req))) await answer(request);
      if (done(messages)) return messages;
      await page.waitForTimeout(25);
    }
    throw new Error('upload cancellation fixture timed out: ' + req);
  }
  async function terminal(req, sign = true) {
    const messages = await drive(req, messages => messages.some(m => m.t === 'result' && m.req === req), sign);
    pending.delete(req);
    return messages.find(m => m.t === 'result' && m.req === req);
  }
  async function act(action) {
    const req = 'upload-cancel-control-' + (++serial);
    await send({ t: 'act', req, action });
    return terminal(req);
  }
  async function begin(account, server) {
    const req = 'upload-cancel-file-' + (++serial);
    pending.add(req);
    await page.evaluate(({ req, account, server }) => window.worker.postMessage({ t: 'act', req, action: {
      a: 'upload', as: account, server, name: 'fixture.png', mime: 'image/png',
      bytes: new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]).buffer,
    } }), { req, account, server });
    return req;
  }
  const cancelled = async req => {
    await send({ t: 'upload.cancel', req });
    const value = await terminal(req, false);
    if (value.ok || value.cancelled !== true || value.error || value.uploaded) throw new Error('cancellation was not explicitly acknowledged');
    await send({ t: 'upload.cancel', req });
    return value;
  };
  const waitClosed = async record => {
    for (let i = 0; i < 120 && !record.closed; i++) await page.waitForTimeout(25);
    return record.closed && !record.complete;
  };
  try {
    for (const pattern of allowed) await page.context().route(pattern, pass);
    check('cancel fixture creates local signer', (await act({ a: 'account.add', how: 'create' })).ok);
    const local = (await all()).filter(m => m.t === 'accounts').at(-1).active;
    created.push(local);
    if (!oldKeys.has(bunker.pubkey)) {
      check('cancel fixture connects bunker', (await act({ a: 'account.add', how: 'key', key: 'bunker://' + bunker.pubkey + '?relay=' + encodeURIComponent(origin.replace('http:', 'ws:') + '/bunker') })).ok);
      created.push(bunker.pubkey);
    }
    for (const [kind, account] of [['local', local], ['extension', note.pubkey], ['remote', bunker.pubkey]]) {
      const fixture = media.bySigner[kind];
      for (const mode of ['hang', 'body-hang']) {
        fixture.set('blossom', mode);
        const first = fixture.requests.length;
        const req = await begin(account, fixture.origins.blossom);
        await drive(req, () => fixture.requests.slice(first).some(r => r.path === '/upload' && r.method === 'PUT'));
        const record = fixture.requests.slice(first).find(r => r.path === '/upload' && r.method === 'PUT');
        if (mode === 'body-hang') await drive(req, () => record.valid === true);
        await cancelled(req);
        check(kind + ' cancellation aborts ' + mode + ' socket', await waitClosed(record));
        await page.waitForTimeout(100);
        check(kind + ' cancellation has no HTTP fallback', fixture.requests.slice(first).filter(r => r.method !== 'OPTIONS').length === 1);
        check(kind + ' cancellation emits one terminal', (await all()).filter(m => m.t === 'result' && m.req === req).length === 1);
        fixture.set('blossom', 'ok');
        check(kind + ' cancelled slot accepts a new upload', (await terminal(await begin(account, fixture.origins.blossom))).ok);
      }
      fixture.set('nip96', 'processing-hold');
      for (const stage of ['pause', 'get']) {
        const first = fixture.requests.length;
        const req = await begin(account, fixture.origins.nip96);
        await drive(req, messages => stage === 'pause'
          ? messages.some(m => m.t === 'progress' && m.req === req && m.phase === 'processing')
          : fixture.requests.slice(first).some(r => r.path === '/processing'));
        const record = fixture.requests.slice(first).find(r => r.path === '/processing');
        await cancelled(req);
        if (stage === 'get') check(kind + ' cancellation aborts processing GET', await waitClosed(record));
        await page.waitForTimeout(1200);
        check(kind + ' cancellation stops subsequent processing polls', fixture.requests.slice(first).filter(r => r.path === '/processing').length === (stage === 'get' ? 1 : 0));
      }
      check(kind + ' cancellation never deletes a remote blob', fixture.requests.every(r => r.method !== 'DELETE'));
    }
    // A pending extension response must not complete or consume the next job.
    const extension = media.bySigner.extension;
    extension.set('blossom', 'ok');
    const first = extension.requests.length;
    const old = await begin(note.pubkey, extension.origins.blossom);
    const messages = await drive(old, messages => messages.some(m => m.t === 'sign' && m.actionReq === old), false);
    const oldSign = messages.find(m => m.t === 'sign' && m.actionReq === old);
    await cancelled(old);
    const next = await begin(note.pubkey, extension.origins.blossom);
    await drive(next, messages => messages.some(m => m.t === 'sign' && m.actionReq === next), false);
    await answer(oldSign);
    await page.waitForTimeout(100);
    check('cancelled extension response cannot start HTTP', extension.requests.length === first);
    check('new extension authorization survives an old response', (await terminal(next)).ok);
    // A held bunker request owns sockets that cancellation must release immediately.
    for (let i = 0; i < 100 && bunker.connections(); i++) await page.waitForTimeout(25);
    bunker.hold(true);
    const remote = await begin(bunker.pubkey, media.bySigner.remote.origins.blossom);
    await drive(remote, () => bunker.waiting() > 0, false);
    await cancelled(remote);
    for (let i = 0; i < 100 && bunker.connections(); i++) await page.waitForTimeout(25);
    check('cancelled bunker authorization closes its sockets', bunker.connections() === 0);
    bunker.hold(false);
    await uploadOwnership({page,media,check,origin,note,signer,lines});
  } finally {
    bunker.hold(false);
    for (const req of pending) await send({ t: 'upload.cancel', req }).catch(() => {});
    for (const pubkey of created.reverse()) await act({ a: 'account.remove', pubkey }).catch(() => {});
    if (oldActive) await act({ a: 'account.use', pubkey: oldActive }).catch(() => {});
    for (const pattern of allowed) await page.context().unroute(pattern, pass);
    await media.close();
  }
}
