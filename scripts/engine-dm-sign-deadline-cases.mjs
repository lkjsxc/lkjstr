// Virtual deadlines exercise the production timer callback; elapsed wall time is not claimed as 60 seconds.
export async function privateSignCases({ make, fixtures, fake, check }) {
  const extension = await make('extension');
  const automated = new Set();
  async function nextSignature(client, before) {
    const end = Date.now() + 15_000;
    while (Date.now() < end) {
      const messages = await client.messages();
      for (const request of messages.filter((m) => m.t === 'crypt' && !automated.has(m.req))) {
        automated.add(request.req);
        await client.answer(request);
      }
      const next = messages.find((m) => m.t === 'sign' && !before.has(m.req));
      if (next) return next;
      await client.page.waitForTimeout(20);
    }
    throw new Error('private signature fixture did not receive its sign request');
  }
  async function expire(client) {
    const before = (await client.messages()).filter((m) => m.t === 'fixture.expired').length;
    await client.send({ t: 'fixture.expire' });
    const all = await client.until(
      (all) => all.filter((m) => m.t === 'fixture.expired').length > before,
    );
    const fired = all.filter((m) => m.t === 'fixture.expired').at(-1).milliseconds;
    check(
      'virtual private signer deadline fires an actual requested 60-second timer',
      fired.length === 1 && fired[0] === 60000,
      fired,
    );
  }
  const action = (client, kind) =>
    kind === 'seal'
      ? {
          a: 'dm.send',
          as: client.account,
          draft: { recipients: [client.sender], text: 'private signing deadline fixture' },
        }
      : { a: 'dm.relays.save', as: client.account, relays: [client.relay] };
  try {
    for (const kind of ['advertisement', 'seal']) {
      const published = fake.published.length;
      const seen = new Set(
        (await extension.messages()).filter((m) => m.t === 'sign').map((m) => m.req),
      );
      const req = await extension.begin(action(extension, kind));
      const request = await nextSignature(extension, seen);
      check(
        `extension ${kind} exact-event request has its intended kind`,
        JSON.parse(request.event).kind === (kind === 'seal' ? 13 : 10050),
      );
      await expire(extension);
      const result = await extension.finish(req);
      check(
        `extension ${kind} actual deadline is not a missing signer`,
        result.error?.code === 'signer-timeout',
        result.error?.code,
      );
      const signed = await fixtures.extension.call(JSON.parse(request.event));
      await extension.send({ t: 'signed', req: request.req, event: JSON.stringify(signed) });
      await extension.barrier();
      check(
        `late extension ${kind} signature cannot publish or settle twice`,
        fake.published.length === published &&
          (await extension.messages()).filter((m) => m.t === 'result' && m.req === req).length ===
            1,
      );
    }
    const seen = new Set(
      (await extension.messages()).filter((m) => m.t === 'sign').map((m) => m.req),
    );
    const req = await extension.begin(action(extension, 'advertisement'));
    const request = await nextSignature(extension, seen);
    await extension.send({ t: 'signed', req: request.req, error: 'fixture refusal' });
    check(
      'explicit extension signing refusal remains refusal',
      (await extension.finish(req)).error?.code === 'signer-refused',
    );
  } finally {
    await extension.close();
  }
  fixtures.mode({});
  const remote = await make('remote');
  try {
    for (const kind of ['advertisement', 'seal']) {
      fixtures.mode({ holdSign: true });
      const published = fake.published.length,
        held = fixtures.held();
      const req = await remote.begin(action(remote, kind));
      await remote.until(() => fixtures.held() > held);
      await expire(remote);
      const result = await remote.finish(req);
      check(
        `bunker ${kind} actual deadline is not a missing signer`,
        result.error?.code === 'signer-timeout',
        result.error?.code,
      );
      await fixtures.release();
      await remote.barrier();
      check(
        `late bunker ${kind} signature cannot publish or settle twice`,
        fake.published.length === published &&
          (await remote.messages()).filter((m) => m.t === 'result' && m.req === req).length === 1,
      );
      check(`bunker ${kind} deadline closes its temporary sockets`, fixtures.connections() === 0);
    }
    for (const [signError, code] of [
      ['unsupported', 'unsupported'],
      ['not authorized', 'signer-refused'],
      ['signer-timeout', 'signer-refused'],
    ]) {
      fixtures.mode({ signError });
      const result = await remote.act(action(remote, 'advertisement'));
      check(
        `authenticated bunker signing error ${signError} maps to ${code}`,
        result.error?.code === code,
        result.error?.code,
      );
    }
    fixtures.mode({ closeSign: true });
    check(
      'bunker socket loss remains missing rather than a fabricated deadline',
      (await remote.act(action(remote, 'advertisement'))).error?.code === 'signer-missing',
    );
  } finally {
    fixtures.mode({});
    await remote.close();
  }
}
