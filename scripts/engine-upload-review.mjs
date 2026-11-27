// Review regressions: isolated HTTP, a real Worker and the native fixture signer.
import { createHash } from 'node:crypto';
export async function uploadReview({ page, send, wait, check, note, signer, lines }) {
  const servers = ['https://upload-review-one.test', 'https://upload-review-two.test'];
  const bytes = [1, 2, 3, 4];
  const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  const requests = [], held = [], used = new Set();
  const messageStart = await page.evaluate(() => window.messages.length);
  let mode = 'ok', serial = 0;
  const all = () => page.evaluate(start => window.messages.slice(start), messageStart);
  const result = async (req) => {
    await wait(r => window.messages.some(m => m.t === 'result' && m.req === r), req);
    return (await all()).find(m => m.t === 'result' && m.req === req);
  };
  const nextSign = async () => {
    await wait(({used,start}) => window.messages.slice(start).some(m => m.t === 'sign' && m.req.startsWith('upload-auth-') && !used.includes(m.req)), {used:[...used],start:messageStart});
    const request = (await all()).find(m => m.t === 'sign' && m.req.startsWith('upload-auth-') && !used.has(m.req));
    used.add(request.req);
    return request;
  };
  for (const m of await all()) if (m.t === 'sign') used.add(m.req);
  const answer = async (request) => {
    signer.stdin.write(`${request.event}\n`);
    const event = JSON.parse((await lines.next()).value);
    await send({ t: 'signed', req: request.req, event: JSON.stringify(event) });
  };
  const save = async (destinations) => {
    const req = `upload-review-list-${++serial}`;
    await send({ t: 'act', req, action: { a: 'servers.save', as: note.pubkey, servers: destinations } });
    await wait(r => window.messages.some(m => m.t === 'sign' && m.req === r), req);
    await answer((await all()).find(m => m.t === 'sign' && m.req === req));
    if (!(await result(req)).ok) throw new Error('review list save failed');
  };
  const begin = async (server) => {
    const req = `upload-review-${++serial}`;
    await page.evaluate(({ req, account, server, bytes }) => window.worker.postMessage({
      t: 'act', req, action: { a: 'upload', as: account, server, name: 'fixture.png', mime: 'image/png', bytes: new Uint8Array(bytes).buffer },
    }), { req, account: note.pubkey, server, bytes });
    return req;
  };
  // Advance only the deadline lane; await application before releasing HTTP.
  const clock = (ms) => page.evaluate(ms => new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    const timer = setTimeout(() => {
      port1.close();
      reject(new Error('upload deadline clock did not answer'));
    }, 5000);
    port1.onmessage = () => {
      clearTimeout(timer);
      port1.close();
      resolve();
    };
    window.worker.postMessage({ t: 'test.uploadClock', ms }, [port2]);
  }), ms);
  const handler = async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    requests.push({ url: url.href, method });
    const reply = (status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.origin === servers[1]) return reply(201, { url: `${servers[1]}/${hash}.png`, sha256: hash });
    if (method === 'HEAD') return reply(200, {});
    if (mode === 'absent') return reply(404, {});
    if (mode === 'down') return reply(503, {});
    if (mode === 'hold') { held.push(route); return; }
    if (mode === 'late-discovery') {
      if (url.pathname === '/upload') { await clock(282_000); return reply(404, {}); }
      held.push(route); return;
    }
    if (mode === 'late-signer') { await clock(280_000); return reply(503, {}); }
    if (mode === 'late-processing') {
      if (url.pathname === '/upload') return reply(404, {});
      if (url.pathname.endsWith('nip96.json')) return reply(200, { api_url: `${servers[0]}/api` });
      if (url.pathname === '/api') { await clock(284_000); return reply(202, { status: 'processing', processing_url: `${servers[0]}/processing` }); }
      throw new Error('processing request started after aggregate deadline');
    }
    return reply(201, { url: `${servers[0]}/${hash}.png`, sha256: hash });
  };
  await page.context().route('https://upload-review-*.test/**', handler);
  try {
    await save([servers[0]]);
    let req = await begin(servers[0]);
    await answer(await nextSign());
    check('review establishes Blossom with a real upload', (await result(req)).ok);
    mode = 'absent';
    req = await begin(servers[0]);
    await answer(await nextSign());
    check('review failed alternative discovery remains visible', (await result(req)).error?.code === 'upload-discovery');
    mode = 'ok';
    const before = requests.length;
    await send({ t: 'act', req: 'upload-review-check', action: { a: 'servers.check', server: servers[0] } });
    await result('upload-review-check');
    check('review row retry keeps known Blossom after failed discovery', requests.slice(before).some(r => r.method === 'HEAD') && !requests.slice(before).some(r => r.url.endsWith('nip96.json')));
    req = await begin(servers[0]);
    await answer(await nextSign());
    check('review explicit retry recovers restored Blossom', (await result(req)).ok);

    mode = 'down';
    req = await begin(servers[0]);
    await answer(await nextSign());
    const failure = await result(req);
    const skipped = await result(await begin());
    check('review all failed destinations retain server and reason', skipped.error?.code === failure.error?.code && skipped.error?.message === servers[0] && skipped.error?.code !== 'not-found');
    await save([]);
    const empty = await result(await begin());
    check('review explicit empty server list remains not found', empty.error?.code === 'not-found' && !empty.error?.message);

    await save(servers);
    // Reset the first row's verdict, then hold one attachment at signer permission.
    await send({ t: 'act', req: 'upload-review-reset', action: { a: 'servers.check', server: servers[0] } });
    await result('upload-review-reset');
    const pending = await begin();
    const pendingSign = await nextSign();
    const concurrent = await begin(servers[0]);
    await answer(await nextSign());
    await result(concurrent); // This attachment marks the same destination down.
    await send({ t: 'signed', req: pendingSign.req, error: 'fixture refusal' });
    check('review concurrent HTTP failure cannot cause signer refusal fallback', (await result(pending)).error?.code === 'signer-refused');

    for (const stage of ['http', 'discovery', 'signer', 'processing']) {
      mode = 'ok';
      await send({ t: 'act', req: `upload-review-reset-${stage}`, action: { a: 'servers.check', server: servers[0] } });
      await result(`upload-review-reset-${stage}`);
      mode = stage === 'http' ? 'hold' : `late-${stage}`;
      const firstRequest = requests.length;
      req = await begin();
      const signing = await nextSign();
      if (stage === 'http') await clock(282_000);
      await answer(signing);
      if (stage === 'processing') await answer(await nextSign());
      let late;
      if (stage === 'signer') {
        late = await nextSign(); // Fallback signing gets only the remaining budget.
        check('review deadline advance leaves signer epoch on the real clock',
          Number.isSafeInteger(late.expiresAt) && late.expiresAt <= Date.now() + 10_000);
      }
      const timeout = await result(req);
      const attempted = requests.slice(firstRequest);
      const reached = stage === 'discovery' ? attempted.some(r => r.url.endsWith('nip96.json'))
        : stage === 'processing' ? attempted.some(r => r.url.endsWith('/api'))
        : attempted.some(r => r.url.endsWith('/upload'));
      check(`review aggregate deadline bounds ${stage} before client watchdog`, reached && timeout.error?.code === 'upload-timeout' && !attempted.some(r => r.url.startsWith(servers[1])));

      if (late) {
        const count = requests.length;
        await answer(late);
        await page.waitForTimeout(100);
        check('review late signer reply cannot upload after deadline', requests.length === count);
      }
      for (const route of held.splice(0)) await route.abort().catch(() => {});
    }
  } finally {
    for (const route of held) await route.abort().catch(() => {});
    await page.context().unroute('https://upload-review-*.test/**', handler);
    await save(['https://media.engine.test']);
  }
}
