// A writable absent draft must already have an authenticated, durable wrapped seed.
import { archiveDisk } from './engine-draft-client.mjs';
async function either(client, req, old = []) {
  return client.until(all => all.some(m => m.t === 'result' && m.req === req)
    || all.some(m => m.t === 'crypt' && !old.includes(m.req)));
}
export async function firstLoadCases({make, fixtures, check}) {
  for (const recipient of ['extension', 'bunker']) {
    const client = await make(recipient);
    try {
      fixtures.mode({error:'unsupported'});
      const count = fixtures.calls.length;
      const req = await client.begin({a:'dm.draft.load', as:client.account, tab:'fresh'});
      if (recipient === 'extension') {
        const all = await either(client, req), prompt = all.find(m => m.t === 'crypt');
        check('first absent load waits for seed authorization', Boolean(prompt)
          && !all.some(m => m.t === 'result' && m.req === req));
        if (prompt) await client.answer(prompt, 'unsupported');
      }
      const result = await client.finish(req);
      check('first load refuses before writable absence for ' + recipient,
        !result.ok && result.error?.code === 'unsupported', result.error?.code ?? 'writable absence');
      if (recipient === 'bunker') check('first bunker load actually asked for its seed', fixtures.calls.length > count);
      const disk = await archiveDisk(client.page, [client.account], []);
      check('first-load refusal creates no durable archive for ' + recipient, disk.archives[0] === null);
    } finally { await client.close(); fixtures.mode({}); }
  }
  const local = await make('local');
  try {
    const result = await local.act({a:'dm.draft.load', as:local.account, tab:'fresh'});
    const disk = await archiveDisk(local.page, [local.account], []);
    check('local first load returns absent state with a revision', result.ok && result.dmDraft === undefined
      && /^[a-f0-9]{64}$/.test(result.dmDraftRevision));
    check('local first load establishes only encrypted empty catalog', Boolean(disk.archives[0])
      && disk.archives[0].keys.join(',') === 'cipherCatalog,version,wrappedSeed'
      && (await local.crypts()).length === 0);
  } finally { await local.close(); }

  const client = await make('extension');
  try {
    const req = await client.begin({a:'dm.draft.load', as:client.account, tab:'fresh'});
    const all = await either(client, req), prompt = all.find(m => m.t === 'crypt');
    if (prompt) await client.answer(prompt);
    const loaded = await client.finish(req), initial = (await client.crypts()).map(m => m.req);
    check('authorized first load preserves absence and its revision', loaded.ok && loaded.dmDraft === undefined
      && /^[a-f0-9]{64}$/.test(loaded.dmDraftRevision));
    const save = await client.begin({a:'dm.draft.save', as:client.account, tab:'fresh', expected:loaded.dmDraftRevision,
      state:{draft:{recipients:[], text:'first keystroke retained marker'},failed:[]}});
    const after = await either(client, save, initial), unexpected = after.find(m => m.t === 'crypt' && !initial.includes(m.req));
    check('first keystroke save never introduces a first signer prompt', !unexpected);
    if (unexpected) await client.answer(unexpected);
    check('first keystroke save commits through its loaded revision', (await client.finish(save)).ok);
    const disk = await archiveDisk(client.page, [client.account], ['first keystroke retained marker']);
    check('initialized first save persists ciphertext only', disk.privateTextAbsent && Boolean(disk.archives[0]));
  } finally { await client.close(); }
  await concurrentFirstLoad({make, fixtures, check});
}
async function concurrentFirstLoad({make, fixtures, check}) {
  const first = await make('extension'), page = await first.page.context().newPage();
  try {
    await page.goto(first.relay.replace('ws:', 'http:'));
    await page.evaluate(() => {
      window.messages = []; window.worker = new Worker('/worker.js', {type:'module'});
      window.worker.onmessage = e => window.messages.push(e.data);
    });
    const send = input => page.evaluate(input => window.worker.postMessage(input), input);
    const messages = () => page.evaluate(() => window.messages);
    const until = async predicate => {
      const end = Date.now() + 15_000;
      while (Date.now() < end) {
        const all = await messages(); if (predicate(all)) return all;
        await page.waitForTimeout(20);
      }
      throw new Error('concurrent first-load fixture timeout');
    };
    await until(all => all.some(m => m.t === 'ready'));
    const reqA = await first.begin({a:'dm.draft.load', as:first.account, tab:'same'});
    const reqB = 'other-initial-load';
    await send({t:'act',req:reqB,action:{a:'dm.draft.load',as:first.account,tab:'same'}});
    const a = await either(first, reqA), b = await until(all => all.some(m => m.t === 'crypt' || m.t === 'result'));
    const promptA = a.find(m => m.t === 'crypt'), promptB = b.find(m => m.t === 'crypt');
    check('competing first loads both establish authenticated seed candidates', Boolean(promptA && promptB));
    if (!(promptA && promptB)) return;
    const replyB = await fixtures.extension.call({fixtureCrypto:promptB});
    await send({t:'crypted',req:promptB.req,value:replyB.value});
    const resultB = (await until(all => all.some(m => m.t === 'result' && m.req === reqB))).find(m => m.t === 'result' && m.req === reqB);
    await first.answer(promptA);
    await first.until(all => all.some(m => m.t === 'crypt' && m.req !== promptA.req));
    const winner = (await first.crypts()).find(m => m.req !== promptA.req);
    check('losing first-load CAS unwraps the winning seed', winner.operation === 'nip44.decrypt');
    await first.answer(winner);
    const resultA = await first.finish(reqA);
    check('competing absent loads return the same committed revision', resultA.ok && resultB.ok
      && resultA.dmDraft === undefined && resultB.dmDraft === undefined
      && resultA.dmDraftRevision === resultB.dmDraftRevision);
    const saved = await first.act({a:'dm.draft.save', as:first.account, tab:'same', expected:resultA.dmDraftRevision,
      state:{draft:{recipients:[],text:'concurrent initialized marker'},failed:[]}});
    check('CAS loser keeps the winning key for later saves', saved.ok);
    await send({t:'act',req:'other-read',action:{a:'dm.draft.load',as:first.account,tab:'same'}});
    const read = (await until(all => all.some(m => m.t === 'result' && m.req === 'other-read'))).find(m => m.t === 'result' && m.req === 'other-read');
    check('both Workers read the committed state after initial seed race',
      read.ok && read.dmDraft?.draft.text === 'concurrent initialized marker');
  } finally { await page.close(); await first.close(); }
}
