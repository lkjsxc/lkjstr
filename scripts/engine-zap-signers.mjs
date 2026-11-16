// Observed signer refusal and elapsed deadline; no invoice callback after either terminal.
export async function zapSignerFailures({ page, send, check, until, result, answer,
  invoice, account, readonly, bunker, query, callbacks, deadline }) {
  const begin = async req => {
    const start = (await page.evaluate(() => window.messages)).length;
    await send({ t: 'act', req, action: { a: 'zap.invoice', as: account,
      intent: { ...query, comment: 'signer lifetime fixture' } } });
    const all = await until(m => m.slice(start).some(x => x.t === 'sign' && x.actionReq === req));
    return all.slice(start).find(x => x.t === 'sign' && x.actionReq === req);
  };
  const before = callbacks();
  const refused = await begin('zap-extension-refused');
  await send({ t: 'signed', req: refused.req, error: 'fixture refusal' });
  const rejected = await result('zap-extension-refused');
  check('extension refusal remains a typed terminal without an invoice',
    !rejected.ok && rejected.error?.code === 'signer-refused' && !rejected.zapIntent);
  bunker.refuse(true);
  try {
    const reply = await invoice(bunker.pubkey);
    check('remote signer refusal remains a typed terminal without an invoice',
      !reply.ok && reply.error?.code === 'signer-refused' && !reply.zapIntent);
  } finally { bunker.refuse(false); }
  const watch = await invoice(readonly);
  check('read-only account cannot request a zap signature or invoice',
    !watch.ok && watch.error?.code === 'signer-missing' && !watch.zapIntent);
  check('refused and read-only attempts never reached the invoice callback', callbacks() === before);
  if (!deadline) return;
  const request = await begin('zap-extension-deadline'), started = Date.now();
  const all = await until(m => m.some(x => x.t === 'result' && x.req === 'zap-extension-deadline'), 75_000);
  const timed = all.find(x => x.t === 'result' && x.req === 'zap-extension-deadline');
  const elapsed = Date.now() - started;
  check('elapsed 60-second extension deadline returns signer-timeout',
    elapsed >= 59_000 && !timed.ok && timed.error?.code === 'signer-timeout' && !timed.zapIntent);
  console.log(JSON.stringify({ zapSignerDeadlineMs: elapsed, virtualClock: false }));
  await answer(request);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.messages);
  check('late signer completion cannot revive an expired invoice',
    callbacks() === before && after.filter(m => m.t === 'result' && m.req === 'zap-extension-deadline').length === 1);
}
